import { Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

import { supabaseAdmin } from './config/supabase';

type TranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionId: string;
};

const transcripts = new Map<string, TranscriptMessage[]>();

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return next(new Error('Authentication error'));
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const userId = (socket.data.user as any)?.id || socket.id;

  socket.on('speech:transcript', (payload: { sessionId?: string; text?: string }) => {
    if (!payload || !payload.text) return;
    const sessionId = payload.sessionId || 'default';
    const key = `${userId}:${sessionId}`;
    const list = transcripts.get(key) || [];
    const now = Date.now();

    const userMessage: TranscriptMessage = {
      id: `user_${now}`,
      role: 'user',
      content: payload.text,
      timestamp: now,
      sessionId,
    };

    const assistantMessage: TranscriptMessage = {
      id: `assistant_${now}`,
      role: 'assistant',
      content: `I heard you say: "${payload.text}"`,
      timestamp: now,
      sessionId,
    };

    list.push(userMessage);
    list.push(assistantMessage);
    transcripts.set(key, list);

    socket.emit('avatar:response', {
      sessionId,
      message: assistantMessage,
    });
  });

  socket.on('disconnect', () => {
    transcripts.forEach((_value, key) => {
      if (key.startsWith(userId)) {
        transcripts.delete(key);
      }
    });
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Realtime server running on port ${PORT}`);
});
