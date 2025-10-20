import { WebSocketManager } from '../src/services/websocket-manager';
import { Server as WebSocketServer } from 'ws';
import WSCSLIPayload from '../src/utils/websockets';

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // OPEN
  bufferedAmount = 0;
  isAlive = true;

  send = jest.fn();
  ping = jest.fn();
  close = jest.fn();
  terminate = jest.fn();
  on = jest.fn();
}

describe('WebSocketManager', () => {
  let wss: WebSocketServer;
  let manager: WebSocketManager;

  beforeEach(() => {
    wss = new WebSocketServer({ noServer: true });
    manager = new WebSocketManager(wss, {
      maxConnections: 5,
      maxBufferSize: 1024
    });
  });

  afterEach(() => {
    wss.close();
  });

  describe('Connection handling', () => {
    it('should handle new connections', () => {
      const mockWs = new MockWebSocket();

      // Simulate connection
      wss.emit('connection', mockWs);

      expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should reject connections when at max capacity', () => {
      const connections: MockWebSocket[] = [];

      // Fill up to max connections
      for (let i = 0; i < 5; i++) {
        const ws = new MockWebSocket();
        connections.push(ws);
        wss.emit('connection', ws);
      }

      // Try one more
      const extraWs = new MockWebSocket();
      wss.emit('connection', extraWs);

      expect(extraWs.close).toHaveBeenCalledWith(1008, 'Maximum connections reached');
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all connected clients', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      wss.emit('connection', ws1);
      wss.emit('connection', ws2);

      const payload: WSCSLIPayload = {
        type: 'block',
        data: 12345
      };

      manager.broadcast(payload);

      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(payload));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(payload));
    });

    it('should skip clients with full buffers', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      ws2.bufferedAmount = 2000; // Over the limit

      wss.emit('connection', ws1);
      wss.emit('connection', ws2);

      const payload: WSCSLIPayload = { type: 'block', data: 12345 };
      manager.broadcast(payload);

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should skip closed connections', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      ws2.readyState = 3; // CLOSED

      wss.emit('connection', ws1);
      wss.emit('connection', ws2);

      const payload: WSCSLIPayload = { type: 'block', data: 12345 };
      manager.broadcast(payload);

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should handle send errors gracefully', () => {
      const ws = new MockWebSocket();
      ws.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      wss.emit('connection', ws);

      const payload: WSCSLIPayload = { type: 'block', data: 12345 };

      // Should not throw
      expect(() => manager.broadcast(payload)).not.toThrow();
    });
  });

  describe('Keep-alive mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should ping clients periodically', () => {
      const ws = new MockWebSocket();
      wss.emit('connection', ws);

      // Fast-forward 15 seconds
      jest.advanceTimersByTime(15000);

      expect(ws.ping).toHaveBeenCalled();
    });

    it('should terminate unresponsive clients', () => {
      const ws = new MockWebSocket();
      ws.isAlive = false;
      wss.emit('connection', ws);

      // Fast-forward to trigger keep-alive check
      jest.advanceTimersByTime(15000);

      expect(ws.terminate).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should provide connection statistics', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      wss.emit('connection', ws1);
      wss.emit('connection', ws2);

      const stats = manager.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.maxConnections).toBe(5);
      expect(stats.connections).toHaveLength(2);
      expect(stats.connections[0]).toMatchObject({
        id: expect.stringContaining('client-'),
        buffered: 0,
        alive: true
      });
    });
  });

  describe('Graceful shutdown', () => {
    it('should close all connections on shutdown', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      wss.emit('connection', ws1);
      wss.emit('connection', ws2);

      manager.closeAll();

      expect(ws1.close).toHaveBeenCalledWith(1000, 'Server shutting down');
      expect(ws2.close).toHaveBeenCalledWith(1000, 'Server shutting down');
    });
  });
});