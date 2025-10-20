/**
 * Thread-safe WebSocket connection manager
 *
 * Addresses the race condition identified in PR #22 where concurrent access
 * to the WebSocket clients set could cause crashes or undefined behavior.
 */

import { WebSocket, Server as WebSocketServer } from 'ws';
import WSCSLIPayload from '../utils/websockets';

export interface ManagedWebSocket extends WebSocket {
  isAlive: boolean;
  connectionTime: number;
  clientId: string;
}

export class WebSocketManager {
  private clients: Map<string, ManagedWebSocket> = new Map();
  private connectionIdCounter = 0;
  private maxConnections: number;
  private maxBufferSize: number;

  constructor(
    private wss: WebSocketServer,
    options?: {
      maxConnections?: number;
      maxBufferSize?: number;
    }
  ) {
    this.maxConnections = options?.maxConnections ?? 100;
    this.maxBufferSize = options?.maxBufferSize ?? 1024 * 1024; // 1MB default

    this.setupConnectionHandling();
    this.startKeepAlive();
  }

  private setupConnectionHandling() {
    this.wss.on('connection', (ws: WebSocket) => {
      // Check connection limit
      if (this.clients.size >= this.maxConnections) {
        ws.close(1008, 'Maximum connections reached');
        return;
      }

      const clientId = `client-${++this.connectionIdCounter}`;
      const managedWs = ws as ManagedWebSocket;

      managedWs.isAlive = true;
      managedWs.connectionTime = Date.now();
      managedWs.clientId = clientId;

      // Add to managed clients
      this.clients.set(clientId, managedWs);

      // Handle pong for keep-alive
      managedWs.on('pong', () => {
        managedWs.isAlive = true;
      });

      // Handle close
      managedWs.on('close', () => {
        this.clients.delete(clientId);
      });

      // Handle errors
      managedWs.on('error', (err) => {
        console.error(`WebSocket error for ${clientId}:`, err);
        this.clients.delete(clientId);
      });
    });
  }

  private startKeepAlive() {
    const interval = setInterval(() => {
      // Create a snapshot of client IDs to avoid concurrent modification
      const clientIds = Array.from(this.clients.keys());

      for (const clientId of clientIds) {
        const ws = this.clients.get(clientId);
        if (!ws) continue; // Client may have been removed

        if (!ws.isAlive) {
          // Client didn't respond to last ping
          try {
            ws.terminate();
          } catch (err) {
            console.error(`Error terminating client ${clientId}:`, err);
          }
          this.clients.delete(clientId);
          continue;
        }

        ws.isAlive = false;
        try {
          ws.ping();
        } catch (err) {
          console.error(`Error pinging client ${clientId}:`, err);
          this.clients.delete(clientId);
        }
      }
    }, 15000);

    // Clean up on server close
    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * Broadcast a message to all connected clients
   * Thread-safe: Creates a snapshot of clients before iteration
   */
  broadcast(payload: WSCSLIPayload) {
    const serialized = JSON.stringify(payload);
    const serializedBuffer = Buffer.from(serialized);

    // Check message size
    if (serializedBuffer.length > this.maxBufferSize) {
      console.warn(`Broadcast message too large: ${serializedBuffer.length} bytes`);
      return;
    }

    // Create snapshot of clients to avoid concurrent modification
    const clients = Array.from(this.clients.values());

    let successCount = 0;
    let errorCount = 0;

    for (const client of clients) {
      if (client.readyState !== WebSocket.OPEN) continue;

      // Check client buffer
      const buffered = client.bufferedAmount ?? 0;
      if (buffered >= this.maxBufferSize) {
        console.warn(`Client ${client.clientId} buffer full (${buffered} bytes), skipping`);
        continue;
      }

      try {
        client.send(serialized);
        successCount++;
      } catch (err) {
        errorCount++;
        console.error(`Error broadcasting to client ${client.clientId}:`, err);
      }
    }

    if (errorCount > 0) {
      console.warn(`Broadcast completed: ${successCount} successful, ${errorCount} errors`);
    }
  }

  /**
   * Get current connection statistics
   */
  getStats() {
    const clients = Array.from(this.clients.values());
    const now = Date.now();

    return {
      totalConnections: this.clients.size,
      maxConnections: this.maxConnections,
      connections: clients.map(client => ({
        id: client.clientId,
        connected: now - client.connectionTime,
        buffered: client.bufferedAmount ?? 0,
        alive: client.isAlive
      }))
    };
  }

  /**
   * Gracefully close all connections
   */
  closeAll() {
    const clients = Array.from(this.clients.values());

    for (const client of clients) {
      try {
        client.close(1000, 'Server shutting down');
      } catch (err) {
        console.error(`Error closing client ${client.clientId}:`, err);
      }
    }

    this.clients.clear();
  }
}