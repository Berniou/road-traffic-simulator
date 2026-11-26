export class RealtimeConnection {
  #url;
  #WebSocket;
  #loadPositions;
  #onPosition;
  #onStatusChange;
  #onError;
  #setTimeout;
  #clearTimeout;
  #initialReconnectDelay;
  #maxReconnectDelay;
  #reconnectDelay;
  #reconnectTimer = null;
  #socket = null;
  #socketReady = false;
  #pendingPositions = [];
  #started = false;

  constructor({
    url,
    WebSocket: WebSocketImplementation = window.WebSocket,
    loadPositions,
    onPosition,
    onStatusChange = () => {},
    onError = () => {},
    initialReconnectDelay = 1000,
    maxReconnectDelay = 30000,
    setTimeout = globalThis.setTimeout,
    clearTimeout = globalThis.clearTimeout,
  }) {
    this.#url = url;
    this.#WebSocket = WebSocketImplementation;
    this.#loadPositions = loadPositions;
    this.#onPosition = onPosition;
    this.#onStatusChange = onStatusChange;
    this.#onError = onError;
    this.#setTimeout = setTimeout;
    this.#clearTimeout = clearTimeout;
    this.#initialReconnectDelay = initialReconnectDelay;
    this.#maxReconnectDelay = maxReconnectDelay;
    this.#reconnectDelay = initialReconnectDelay;
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#reconnectDelay = this.#initialReconnectDelay;
    this.#connect();
  }

  stop() {
    this.#started = false;
    if (this.#reconnectTimer !== null) {
      this.#clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }

    const socket = this.#socket;
    this.#socket = null;
    this.#socketReady = false;
    this.#pendingPositions = [];
    socket?.close();
  }

  #connect() {
    if (!this.#started) return;
    this.#setStatus('connecting');

    let socket;
    try {
      socket = new this.#WebSocket(this.#url);
    } catch (error) {
      this.#onError(error);
      this.#scheduleReconnect();
      return;
    }

    this.#socket = socket;
    this.#socketReady = false;
    this.#pendingPositions = [];

    socket.addEventListener('open', async () => {
      if (!this.#isCurrent(socket)) return;

      try {
        await this.#loadPositions();
      } catch (error) {
        if (this.#isCurrent(socket)) {
          this.#onError(error);
          this.#disconnect(socket);
        }
        return;
      }

      if (!this.#isCurrent(socket)) return;
      this.#socketReady = true;
      this.#reconnectDelay = this.#initialReconnectDelay;
      this.#setStatus('connected');

      const pendingPositions = this.#pendingPositions;
      this.#pendingPositions = [];
      for (const position of pendingPositions) this.#onPosition(position);
    });

    socket.addEventListener('message', (event) => {
      if (!this.#isCurrent(socket)) return;

      let position;
      try {
        position = JSON.parse(event.data);
      } catch (error) {
        this.#onError(error);
        return;
      }

      if (this.#socketReady) this.#onPosition(position);
      else this.#pendingPositions.push(position);
    });

    socket.addEventListener('close', () => this.#disconnect(socket));
    socket.addEventListener('error', (error) => {
      if (!this.#isCurrent(socket)) return;
      this.#onError(error);
      this.#disconnect(socket);
    });
  }

  #disconnect(socket) {
    if (!this.#isCurrent(socket)) return;
    this.#socket = null;
    this.#socketReady = false;
    this.#pendingPositions = [];
    socket.close();
    this.#scheduleReconnect();
  }

  #scheduleReconnect() {
    if (!this.#started || this.#reconnectTimer !== null) return;

    this.#setStatus('disconnected');
    const delay = this.#reconnectDelay;
    this.#reconnectDelay = Math.min(delay * 2, this.#maxReconnectDelay);
    this.#reconnectTimer = this.#setTimeout(() => {
      this.#reconnectTimer = null;
      this.#connect();
    }, delay);
  }

  #isCurrent(socket) {
    return this.#started && this.#socket === socket;
  }

  #setStatus(status) {
    this.#onStatusChange(status);
  }
}
