package com.mnasri.core.controller;

import com.mnasri.core.model.Order;
import com.mnasri.core.repository.OrderRepository;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final RabbitTemplate rabbitTemplate;

    // Spring will automatically inject the RabbitTemplate bean here
    public OrderController(OrderRepository orderRepository, RabbitTemplate rabbitTemplate) {
        this.orderRepository = orderRepository;
        this.rabbitTemplate = rabbitTemplate;
    }

    @PostMapping
    public Order createOrder(@RequestBody Order order) {
        order.setStatus("PENDING");
        Order savedOrder = orderRepository.save(order);
        
        // Asynchronously broadcast the order event to the RabbitMQ queue
        try {
            String message = String.format("{\"id\": %d, \"product\": \"%s\", \"quantity\": %d, \"price\": %s, \"status\": \"%s\"}",
                    savedOrder.getId(), savedOrder.getProduct(), savedOrder.getQuantity(), savedOrder.getPrice().toString(), savedOrder.getStatus());
            
            rabbitTemplate.convertAndSend("order_queue", message);
            System.out.println(" [Core] Successfully published order event to RabbitMQ broker matrix.");
        } catch (Exception e) {
            System.err.println(" [Core] Failed to dispatch event packet to Broker: " + e.getMessage());
        }

        return savedOrder;
    }

    @GetMapping
    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }
}