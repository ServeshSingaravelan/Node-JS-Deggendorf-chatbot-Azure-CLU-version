import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io();

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on('response', (data) => {
      addMessage(`DegBot: ${data.text}`, 'bot');
    });

    socket.on('clear', () => {
      setTimeout(clearChatbotPage, 3000);
    });

    return () => {
      socket.off('response');
      socket.off('clear');
    };
  }, []);

  const addMessage = (message, sender) => {
    setMessages((prevMessages) => [...prevMessages, { text: message, sender }]);
  };

  const clearChatbotPage = () => {
    setMessages([]);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (input) {
      socket.emit('message', input);
      addMessage(`You: ${input}`, 'user');
      setInput('');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div id="chat-container">
      <h1>Degbot</h1>
      <p className="description">This is a chatbot to help students who are new to Deggendorf!</p>
      <div id="chat">
        <div id="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message-container ${msg.sender}`}>
              <div className={`message ${msg.sender}`}>
                <div className="message-icon">
                  {msg.sender === 'user' ? '🧑' : '🧠'}
                </div>
                <div className="message-text">
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form id="message-form" onSubmit={handleSubmit}>
          <input
            id="message-input"
            type="text"
            placeholder="Type in 'Hello' to start!"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};

export default App;
