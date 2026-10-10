package com.iam.config;

import com.github.fppt.jedismock.RedisServer;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.Socket;

/**
 * Embedded Redis Server for local development and testing when external Redis is not running.
 * Uses pure Java Redis mock engine compliant with the RESP protocol.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty(name = "iam.redis.embedded-fallback", havingValue = "true", matchIfMissing = true)
public class EmbeddedRedisServer {

    private static final Logger log = LoggerFactory.getLogger(EmbeddedRedisServer.class);

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    private RedisServer server;
    private boolean started = false;

    @PostConstruct
    public void start() {
        if (!"localhost".equalsIgnoreCase(redisHost) && !"127.0.0.1".equals(redisHost)) {
            log.info("Redis host is configured for remote server ({}:{}). Skipping embedded Redis.", redisHost, redisPort);
            return;
        }

        if (isPortInUse(redisHost, redisPort)) {
            log.info("Redis or another service is already listening on {}:{}. Using external service.", redisHost, redisPort);
            return;
        }

        try {
            log.info("No external Redis detected on port {}. Starting embedded RESP Redis server...", redisPort);
            server = RedisServer.newRedisServer(redisPort);
            server.start();
            started = true;
            log.info("Embedded Redis server successfully started on port {}.", redisPort);
        } catch (Exception e) {
            log.warn("Could not start embedded Redis on port {}: {}", redisPort, e.getMessage());
        }
    }

    @PreDestroy
    public void stop() {
        if (server != null && started) {
            try {
                server.stop();
                log.info("Embedded Redis server stopped.");
            } catch (IOException e) {
                log.error("Error stopping embedded Redis server: {}", e.getMessage());
            }
        }
    }

    public boolean isStarted() {
        return started;
    }

    public void stopServerManually() throws IOException {
        if (server != null) {
            server.stop();
            started = false;
        }
    }

    private boolean isPortInUse(String host, int port) {
        try (Socket socket = new Socket(host, port)) {
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
