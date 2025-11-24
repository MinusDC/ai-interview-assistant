// frontend/src/api.js
// simple wrapper for backend calls (uses VITE_API_URL when set, otherwise relative paths)
import axios from 'axios';

// Vite exposes env vars that start with VITE_ via import.meta.env
// If VITE_API_URL is undefined or empty, API_BASE will be '' and axios will use relative URLs.
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

// axios instance — use relative paths when API_BASE is empty
const base = axios.create({
  baseURL: API_BASE, // '' -> requests like '/health' go to same origin; 'https://...' -> absolute
  timeout: 30000,
});

// Upload resume (multipart)
export async function uploadResume(formData) {
  const r = await base.post('/upload-resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return r.data;
}

// Generate questions from resume or fallback
export async function generateQuestions(role, resumeText) {
  const r = await base.post('/generate-questions', { role, resumeText });
  return r.data;
}

// Evaluate answers via AI or fallback
export async function evaluateAnswers(session) {
  const r = await base.post('/evaluate-answers', session);
  return r.data;
}

// Save session
export async function submitSession(payload) {
  const r = await base.post('/submit-session', payload);
  return r.data;
}

// List sessions
export async function listSessions() {
  const r = await base.get('/sessions');
  return r.data;
}

// Delete session
export async function deleteSession(id) {
  const r = await base.delete(`/sessions/${id}`);
  return r.data;
}

// Get one session
export async function getSession(id) {
  const r = await base.get(`/sessions/${id}`);
  return r.data;
}
