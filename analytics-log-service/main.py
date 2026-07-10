import threading
import json
import pika
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

app = FastAPI(title="Analytics Log Service")

# -------------------------------------------------------------------------
# Database Configuration (MongoDB)
# -------------------------------------------------------------------------
MONGO_DETAILS = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_DETAILS)
db = client.ecommerce_analytics
logs_collection = db.order_logs

# -------------------------------------------------------------------------
# RabbitMQ Background Consumer Logic
# -------------------------------------------------------------------------
def start_rabbitmq_consumer():
    # Establish link to the local RabbitMQ instance running in Docker
    connection = pika.BlockingConnection(pika.ConnectionParameters(host='localhost'))
    channel = connection.channel()
    
    # Declare the same queue that our Spring Boot service will publish to
    channel.queue_declare(queue='order_queue', durable=True)
    
    def callback(ch, method, properties, body):
        try:
            order_data = json.loads(body.decode())
            print(f" [Analytics] Received event data from Broker: {order_data}")
            
            # Since BlockingConnection is synchronous, we use a separate client instance 
            # to push directly to MongoDB right from this worker thread context
            import pymongo
            sync_client = pymongo.MongoClient("mongodb://localhost:27017")
            sync_client.ecommerce_analytics.order_logs.insert_one(order_data)
            print(" [Analytics] Successfully saved transaction footprint into MongoDB.")
            
            # Acknowledge completion back to the message broker matrix
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            print(f" [Analytics] Failed to process message stream structure: {e}")

    # Configure consumer configurations
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue='order_queue', on_message_callback=callback)
    
    print(" [*] Analytics engine waiting for order event streams. To exit press CTRL+C")
    channel.start_consuming()

# Launch the RabbitMQ listener inside a non-blocking background thread
consumer_thread = threading.Thread(target=start_rabbitmq_consumer, daemon=True)
consumer_thread.start()

# -------------------------------------------------------------------------
# REST API Endpoints (FastAPI)
# -------------------------------------------------------------------------
@app.get("/analytics")
async def get_all_analytics_logs():
    logs = []
    # Query logs from MongoDB and clean up the internal ObjectId for JSON output
    async for log in logs_collection.find():
        log["_id"] = str(log["_id"])
        logs.append(log)
    return {"total_logs": len(logs), "data": logs}

@app.get("/health")
def health_check():
    return {"status": "Service C is up and monitoring event logs"}