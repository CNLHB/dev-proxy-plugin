<!-- WebSocketTest.vue - WebSocket 连接测试组件 -->
<template>
  <div class="ws-test">
    <h2>WebSocket 连接测试</h2>

    <div class="connection-info">
      <p><strong>目标服务器:</strong> beta-internal.cxmuc.com</p>
      <p><strong>WebSocket 端点:</strong> /ws</p>
      <p><strong>当前状态:</strong> <span :class="statusClass">{{ status }}</span></p>
    </div>

    <div class="controls">
      <button @click="connect" :disabled="isConnected">连接</button>
      <button @click="disconnect" :disabled="!isConnected">断开</button>
      <button @click="sendMessage" :disabled="!isConnected">发送测试消息</button>
      <button @click="clearMessages">清空日志</button>
    </div>

    <div class="messages">
      <h3>消息日志:</h3>
      <div class="message-list">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['message', msg.type]"
        >
          <span class="timestamp">{{ msg.timestamp }}</span>
          <span class="content">{{ msg.content }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WebSocketTest',

  data() {
    return {
      ws: null,
      status: '未连接',
      messages: [],
    };
  },

  computed: {
    isConnected() {
      return this.ws && this.ws.readyState === WebSocket.OPEN;
    },

    statusClass() {
      if (this.isConnected) return 'status-connected';
      if (this.status === '连接中...') return 'status-connecting';
      if (this.status.includes('错误')) return 'status-error';
      return 'status-disconnected';
    },
  },

  methods: {
    connect() {
      try {
        this.addMessage('info', '正在连接...');
        this.status = '连接中...';

        // 构建 WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.addMessage('info', `WebSocket URL: ${wsUrl}`);

        // 创建 WebSocket 连接
        this.ws = new WebSocket(wsUrl);

        // 连接打开
        this.ws.onopen = (event) => {
          this.status = '已连接';
          this.addMessage('success', '✅ WebSocket 连接成功！');
          console.log('[WebSocket] 连接已建立', event);
        };

        // 接收消息
        this.ws.onmessage = (event) => {
          this.addMessage('receive', `📥 收到消息: ${event.data}`);
          console.log('[WebSocket] 收到消息:', event.data);
        };

        // 连接错误
        this.ws.onerror = (error) => {
          this.status = '连接错误';
          this.addMessage('error', `❌ WebSocket 错误: ${error.message || '连接失败'}`);
          console.error('[WebSocket] 错误:', error);
        };

        // 连接关闭
        this.ws.onclose = (event) => {
          this.status = '已断开';
          this.addMessage(
            'info',
            `🔌 连接已关闭 (代码: ${event.code}, 原因: ${event.reason || '未知'})`
          );
          console.log('[WebSocket] 连接已关闭', event);
          this.ws = null;
        };

      } catch (error) {
        this.status = '连接失败';
        this.addMessage('error', `❌ 连接失败: ${error.message}`);
        console.error('[WebSocket] 连接异常:', error);
      }
    },

    disconnect() {
      if (this.ws) {
        this.addMessage('info', '正在断开连接...');
        this.ws.close(1000, '用户主动断开');
      }
    },

    sendMessage() {
      if (this.isConnected) {
        const message = {
          type: 'test',
          timestamp: new Date().toISOString(),
          data: 'Hello from Vue client',
        };

        const messageStr = JSON.stringify(message);
        this.ws.send(messageStr);
        this.addMessage('send', `📤 发送消息: ${messageStr}`);
      }
    },

    clearMessages() {
      this.messages = [];
    },

    addMessage(type, content) {
      this.messages.push({
        type,
        content,
        timestamp: new Date().toLocaleTimeString(),
      });

      // 自动滚动到底部
      this.$nextTick(() => {
        const messageList = this.$el.querySelector('.message-list');
        if (messageList) {
          messageList.scrollTop = messageList.scrollHeight;
        }
      });
    },
  },

  beforeUnmount() {
    if (this.ws) {
      this.ws.close();
    }
  },
};
</script>

<style scoped>
.ws-test {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h2 {
  color: #333;
  margin-bottom: 20px;
}

.connection-info {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.connection-info p {
  margin: 8px 0;
}

.status-connected {
  color: #28a745;
  font-weight: bold;
}

.status-connecting {
  color: #ffc107;
  font-weight: bold;
}

.status-disconnected {
  color: #6c757d;
}

.status-error {
  color: #dc3545;
  font-weight: bold;
}

.controls {
  margin-bottom: 20px;
}

.controls button {
  margin: 5px;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.controls button:hover:not(:disabled) {
  background: #0056b3;
}

.controls button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.messages {
  margin-top: 20px;
}

.messages h3 {
  color: #555;
  margin-bottom: 10px;
}

.message-list {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.message {
  padding: 8px;
  margin: 4px 0;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.message.info {
  background: #e7f3ff;
  border-left: 3px solid #2196F3;
}

.message.success {
  background: #e8f5e9;
  border-left: 3px solid #4CAF50;
}

.message.error {
  background: #ffebee;
  border-left: 3px solid #f44336;
}

.message.send {
  background: #fff3e0;
  border-left: 3px solid #FF9800;
}

.message.receive {
  background: #f3e5f5;
  border-left: 3px solid #9C27B0;
}

.message .timestamp {
  color: #666;
  margin-right: 10px;
  font-weight: bold;
}

.message .content {
  color: #333;
}
</style>
