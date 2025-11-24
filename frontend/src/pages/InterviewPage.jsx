import React, { useState, useEffect, useRef } from "react";
import ResumeUploader from "../components/ResumeUploader";
import ChatWindow from "../components/ChatWindow";
import { generateQuestions, evaluateAnswers, submitSession } from "../api";
import { Button, Modal, Spin } from "antd";

const LS_CUR = "ai-interview:currentSession";

export default function InterviewPage() {
  const [candidate, setCandidate] = useState(null);
  const [session, setSession] = useState(null);
  const [pendingSession, setPendingSession] = useState(null); // session prepared but not started
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [readyPrompt, setReadyPrompt] = useState(false);
  const timerRef = useRef(null);

  //
  // RESTORE: show Welcome Back modal if a saved incomplete session exists
  //
  useEffect(() => {
    const saved = localStorage.getItem(LS_CUR);
    if (!saved) return;
    try {
      const obj = JSON.parse(saved);
      // ignore completed sessions
      if (obj?.session?.completedAt) {
        localStorage.removeItem(LS_CUR);
        return;
      }

      Modal.confirm({
        title: "Welcome back",
        content:
          "You have an unfinished interview. Would you like to resume or start a new session?",
        okText: "Resume",
        cancelText: "Start new",
        onOk() {
          setCandidate(obj.candidate || null);
          setSession(obj.session || null);
          setIndex(obj.index || 0);
          // set remaining to current question's time limit (clamped)
          try {
            const q =
              obj.session &&
              obj.session.questions &&
              obj.session.questions[obj.index || 0];
            if (q && q.timeLimit) setRemaining(Math.min(q.timeLimit, 120));
            else setRemaining(0);
          } catch (e) {
            setRemaining(obj.remaining || 0);
          }
        },
        onCancel() {
          localStorage.removeItem(LS_CUR);
        },
      });
    } catch (e) {
      console.warn("Invalid saved session", e);
      localStorage.removeItem(LS_CUR);
    }
  }, []);

  // persist session
  useEffect(() => {
    if (candidate || session) {
      localStorage.setItem(
        LS_CUR,
        JSON.stringify({ candidate, session, index, remaining })
      );
    }
  }, [candidate, session, index, remaining]);

  // ensure remaining reflects current question when index or session changes
  useEffect(() => {
    if (!session) return;
    const currentQ = session.questions?.[index];
    if (!currentQ) return;
    setRemaining(Math.min(currentQ.timeLimit || 0, 120));
  }, [index, session]);

  // timer countdown
  useEffect(() => {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // timer expired → trigger auto-submit with the current typed content captured by ChatWindow
          // ChatWindow is also wired to call onAutoSubmit when remaining transitions to <=0,
          // but keep this as a safety net to progress if needed.
          try {
            handleAutoSubmit(index, {
              text: session.answers?.[index]?.text || "",
            });
          } catch (e) {
            console.warn("auto-submit fallback error", e);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [session, index]);

  // Called when the uploader parsed the resume and user confirmed
  const handleConfirmParsed = async (parsed) => {
    setCandidate(parsed);
    setLoadingQuestions(true);
    const resp = await generateQuestions(
      "fullstack",
      parsed.name + "\n" + parsed.email + "\n" + parsed.phone
    );
    setLoadingQuestions(false);
    if (resp.ok) {
      const s = {
        id: `s-${Date.now()}`,
        candidate: parsed,
        questions: resp.questions,
        answers: {},
      };
      setPendingSession(s); // not started until user clicks "Start Interview"
      setReadyPrompt(true);
    } else {
      Modal.error({ title: "Error", content: "Could not generate questions" });
    }
  };

  // Save answer when user clicks Submit
  const handleAnswerSubmit = (qIndex, answer) => {
    const enriched = { ...(answer || {}), submittedAt: Date.now() };
    setSession((prev) => {
      if (!prev) return prev;

      const updatedAnswers = {
        ...(prev.answers || {}),
        [qIndex]: enriched,
      };

      const updatedSession = { ...prev, answers: updatedAnswers };

      const isLast = qIndex + 1 >= prev.questions.length;

      if (isLast) {
        // finalize using updatedSession
        setTimeout(() => finishInterview(updatedSession), 0);
      } else {
        setTimeout(() => setIndex(qIndex + 1), 0);
      }

      return updatedSession;
    });
  };

  // Auto-submit when timer expires — accept provided text (may be empty)
  const handleAutoSubmit = (qIndex, answer) => {
    const enriched = { ...(answer || {}), submittedAt: Date.now() };
    setSession((prev) => {
      if (!prev) return prev;

      // if there is already an answer recorded for this index, prefer that existing one but keep timestamp
      const existing = prev.answers?.[qIndex];
      const finalAns = existing
        ? {
            ...existing,
            submittedAt: existing.submittedAt || enriched.submittedAt,
          }
        : enriched;

      const updatedAnswers = {
        ...(prev.answers || {}),
        [qIndex]: finalAns,
      };

      const updatedSession = { ...prev, answers: updatedAnswers };

      const isLast = qIndex + 1 >= prev.questions.length;

      if (isLast) {
        setTimeout(() => finishInterview(updatedSession), 0);
      } else {
        setTimeout(() => setIndex(qIndex + 1), 0);
      }

      return updatedSession;
    });
  };

  const finishInterview = async (finalSession) => {
    const activeSession = finalSession || session;
    if (!activeSession) return;

    setFinishing(true);
    const payload = { ...activeSession };
    const evalResp = await evaluateAnswers(payload);
    const aiResult = evalResp?.ai || evalResp;
    const completed = { ...activeSession, aiResult, completedAt: Date.now() };
    await submitSession(completed);
    localStorage.removeItem(LS_CUR);
    setFinishing(false);
    setSession(null);
    setCandidate(null);
    setIndex(0);
    Modal.success({
      title: "Interview finished",
      content: "Session saved to dashboard.",
    });
  };
  const handleSkipQuestion = () => {
    if (!session) return;
    // Lấy câu trả lời hiện tại, kể cả rỗng
    const currentAnswer = { text: session.answers?.[index]?.text || "" };

    // Gọi hàm handleAutoSubmit vì nó đã chứa logic
    // để lưu câu trả lời và chuyển sang câu hỏi tiếp theo
    handleAutoSubmit(index, currentAnswer);
  };
  // Loader while generating questions
  if (loadingQuestions) {
    return (
      <div className="fullscreen-spinner">
        <Spin size="large" />
        <div className="spinner-tip">Generating Questions…</div>
      </div>
    );
  }

  // Ready prompt before starting (user must click Start Interview)
  if (readyPrompt && pendingSession) {
    return (
      <div className="page-center">
        <div
          className="center-card"
          role="dialog"
          aria-labelledby="ready-title"
        >
          <h2 id="ready-title">Are you ready for the interview?</h2>
          <p style={{ margin: 0, color: "#6b7280" }}>
            The interview session is prepared. Click Start when you're ready.
          </p>
          <div className="center-action">
            <Button
              size="large"
              style={{ minWidth: 100 }}
              onClick={() => {
                // Cancel: clear pending and go back to uploader
                setPendingSession(null);
                setReadyPrompt(false);
                setCandidate(null);
                setSession(null);
                setIndex(0);
              }}
            >
              Cancel
            </Button>

            <Button
              type="primary"
              size="large"
              style={{ minWidth: 100 }}
              onClick={() => {
                // Start interview: set session and initialize timer for first question
                setSession(pendingSession);
                setPendingSession(null);
                setReadyPrompt(false);
                setIndex(0);
                const firstQ = pendingSession.questions?.[0];
                if (firstQ && firstQ.timeLimit)
                  setRemaining(Math.min(firstQ.timeLimit, 120));
                else setRemaining(0);
              }}
            >
              Start Interview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loader while finishing
  if (finishing) {
    return (
      <div className="fullscreen-spinner">
        <Spin size="large" />
        <div className="spinner-tip">Finalizing Interview…</div>
      </div>
    );
  }

  // Resume uploader (initial state)
  if (!candidate || !session) {
    return (
      <div className="page-center">
        <div className="interview-card large-card">
          <ResumeUploader onConfirm={handleConfirmParsed} />
        </div>
      </div>
    );
  }

  // Chat window (live interview)
  return (
    <div className="page-center">
      <ChatWindow
        session={session}
        currentIndex={index}
        remainingSeconds={remaining}
        onSubmitAnswer={handleAnswerSubmit}
        onAutoSubmit={handleAutoSubmit}
        onSkipQuestion={handleSkipQuestion}
      />
    </div>
  );
}
