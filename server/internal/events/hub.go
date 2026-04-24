package events

import "sync"

type Hub struct {
	mu      sync.Mutex
	clients map[chan string]struct{}
}

func NewHub() *Hub { return &Hub{clients: map[chan string]struct{}{}} }

func (h *Hub) Subscribe() chan string {
	ch := make(chan string, 8)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *Hub) Unsubscribe(ch chan string) {
	h.mu.Lock()
	delete(h.clients, ch)
	close(ch)
	h.mu.Unlock()
}

func (h *Hub) Publish(message string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- message:
		default:
		}
	}
}
