import React, { useState, useEffect, useRef } from "react";
import { Card, Input, Button, Progress, Tag } from "antd";

export default function ChatWindow({
  session,
  onSubmitAnswer,
  onAutoSubmit,
  onSkipQuestion,
  currentIndex,
  remainingSeconds,
}) {
  const [text, setText] = useState("");
  const inputRef = useRef();

  // track previous remainingSeconds to detect transition from >0 to <=0
  const prevRemainingRef = useRef();

  useEffect(() => {
    // reset text when question index changes
    setText("");
    if (inputRef.current) inputRef.current.focus();
  }, [currentIndex]);

  useEffect(() => {
    const prev = prevRemainingRef.current;

    // If previous was >0 and now <=0, the timer just expired -> auto-submit
    if (typeof prev !== "undefined" && prev > 0 && remainingSeconds <= 0) {
      if (onAutoSubmit) {
        onAutoSubmit(currentIndex, { text: text.trim() });
      }
      setText("");
    }

    // update prev value for next tick
    prevRemainingRef.current = remainingSeconds;
  }, [remainingSeconds, currentIndex, onAutoSubmit, text]);

  const q = session.questions[currentIndex];

  const submit = () => {
    const answerText = text.trim();
    if (!answerText && answerText !== "") {
      // still allow empty answers (if you want to allow submitting blank, remove this guard)
    }
    if (onSubmitAnswer) {
      onSubmitAnswer(currentIndex, { text: answerText });
    }
    setText("");
  };

  // support Enter to submit (Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() !== "") submit();
    }
  };

  const progressPercent = Math.round(
    ((currentIndex + 1) / (session.questions.length || 1)) * 100
  );

  return (
    <Card className="interview-card" style={{ position: "relative" }}>
      {/* Fixed Timer Section */}
      <div className="timer-box">
        <Progress
          percent={progressPercent}
          showInfo={false}
          size="small"
          style={{ marginBottom: 4 }}
        />
        <div style={{ fontSize: 12, color: "#666", textAlign: "right" }}>
          Time left
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, textAlign: "right" }}>
          {remainingSeconds}s
        </div>
      </div>

      {/* Question Area */}
      <div style={{ marginBottom: 12, paddingRight: 160 }}>
        <div className="question-text" title={q.text}>
          {q.text}
        </div>
        <div style={{ marginTop: 6 }}>
          <Tag
            color={
              q.difficulty === "easy"
                ? "green"
                : q.difficulty === "medium"
                ? "gold"
                : "red"
            }
          >
            {q.difficulty.toUpperCase()}
          </Tag>
          <span style={{ marginLeft: 8 }}>{Math.min(q.timeLimit, 120)}s</span>
        </div>
      </div>

      {/* Answer box */}
      <Input.TextArea
        ref={inputRef}
        rows={10}
        style={{ minHeight: 200, fontSize: 16, lineHeight: 1.6 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your answer..."
        maxLength={10000}
      />
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <Button type="primary" onClick={submit} disabled={!text.trim()}>
          Submit
        </Button>
        <Button onClick={onSkipQuestion}>Next</Button>
      </div>
    </Card>
  );
}
