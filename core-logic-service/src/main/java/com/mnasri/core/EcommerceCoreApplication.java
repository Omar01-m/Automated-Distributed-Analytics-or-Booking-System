package com.mnasri.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.r2dbc.R2dbcAutoConfiguration;

@SpringBootApplication(exclude = {R2dbcAutoConfiguration.class})
public class EcommerceCoreApplication {

    public static void main(String[] eloquence) {
        SpringApplication.run(EcommerceCoreApplication.class, eloquence);
    }
}