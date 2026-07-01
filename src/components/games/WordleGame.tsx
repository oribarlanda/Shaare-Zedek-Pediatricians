"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calcScore, saveScore } from "@/lib/storage";
import GameResult from "@/components/ui/GameResult";

type TileState = "empty" | "correct" | "present" | "absent";

type WordleData = {
  answer: string;
  title?: string;
  subtitle?: string;
  description?: string;
  maxAttempts?: number;
  acceptedAnswers?: string[];
};

type EvaluatedLetter = {
  letter: string;
  state: TileState;
};

const HEBREW_KEYS = [
  ["ק", "ר", "א", "ט", "ו", "ן", "ם", "פ"],
  ["ש", "ד", "ג", "כ", "ע", "י", "ח", "ל", "ך", "ף"],
  ["ז", "ס", "ב", "ה", "נ", "מ", "צ", "ת", "ץ"],
];

const FINAL_TO_REGULAR: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
};

function normalizeWord(value: string) {
  return value
    .trim()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[\s\-_'\"״׳.,!?;:()\[\]{}]/g, "")
    .split("")
    .map((char) => FINAL_TO_REGULAR[char] ?? char)
    .join("");
}

function cleanHebrewInput(value: string) {
  return value.replace(/[^א-ת]/g, "");
}

function evaluateGuess(guess: string, answer: string): EvaluatedLetter[] {
  const guessLetters = guess.split("");
  const answerLetters = answer.split("");
  const result: EvaluatedLetter[] = guessLetters.map((letter) => ({ letter, state: "absent" }));
  const remaining: Record<string, number> = {};

  answerLetters.forEach((letter, index) => {
    if (guessLetters[index] === letter) {
      result[index].state = "correct";
    } else {
      remaining[letter] = (remaining[letter] ?? 0) + 1;
    }
  });

  guessLetters.forEach((letter, index) => {
    if (result[index].state === "correct") return;
    if ((remaining[letter] ?? 0) > 0) {
      result[index].state = "present";
      remaining[letter] -= 1;
    }
  });

  return result;
}

function getKeyboardState(rows: EvaluatedLetter[][]) {
  const priority: Record<TileState, number> = {
    empty: 0,
    absent: 1,
    present: 2,
    correct: 3,
  };
  const states: Record<string, TileState> = {};

  rows.flat().forEach(({ letter, state }) => {
    const current = states[letter] ?? "empty";
    if (priority[state] > priority[current]) states[letter] = state;
  });

  return states;
}

function tileClass(state: TileState, filled: boolean) {
  if (state === "correct") return "bg-[#6aaa64] border-[#6aaa64] text-white";
  if (state === "present") return "bg-[#c9b458] border-[#c9b458] text-white";
  if (state === "absent") return "bg-[#787c7e] border-[#787c7e] text-white";
  if (filled) return "bg-white border-[#878a8c] text-[#1a1a1b]";
  return "bg-white border-[#d3d6da] text-[#1a1a1b]";
}

function keyboardClass(state: TileState | undefined) {
  if (state === "correct") return "bg-[#6aaa64] text-white";
  if (state === "present") return "bg-[#c9b458] text-white";
  if (state === "absent") return "bg-[#787c7e] text-white";
  return "bg-[#d3d6da] text-[#1a1a1b]";
}

export default function WordleGame({ data }: { data: WordleData }) {
  const answer = useMemo(() => normalizeWord(data.answer), [data.answer]);
  const wordLength = answer.length;
  const maxAttempts = data.maxAttempts ?? 6;
  const acceptedAnswers = useMemo(
    () => [answer, ...(data.acceptedAnswers ?? []).map(normalizeWord)].filter(Boolean),
    [answer, data.acceptedAnswers]
  );

  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [message, setMessage] = useState(data.subtitle ?? "נחשו את המילה");
  const [wrong, setWrong] = useState(false);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const evaluatedRows = useMemo(
    () => guesses.map((guess) => evaluateGuess(normalizeWord(guess), answer)),
    [guesses, answer]
  );

  const keyboardState = useMemo(() => getKeyboardState(evaluatedRows), [evaluatedRows]);
  const score = won ? calcScore(100, guesses.length - 1, maxAttempts - 1) : 0;
  const shareText = `⬜ פתרתי את "וורדעל"!\nניקוד: ${score}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const flashMessage = (text: string) => {
    setMessage(text);
    setWrong(true);
    setTimeout(() => setWrong(false), 450);
  };

  const finishGame = (didWin: boolean, nextGuesses: string[]) => {
    const hintsUsed = didWin ? nextGuesses.length - 1 : maxAttempts;
    const finalScore = didWin ? calcScore(100, hintsUsed, maxAttempts - 1) : 0;

    saveScore({
      gameId: "which-song",
      score: finalScore,
      solved: didWin,
      hintsUsed,
      completedAt: Date.now(),
    });
    window.dispatchEvent(new Event("score-updated"));

    setWon(didWin);
    setFinished(true);
    setMessage(didWin ? "בול! פתרתם את המילה" : `נגמרו הניסיונות. המילה הייתה: ${data.answer}`);
  };

  const submitGuess = () => {
    if (finished) return;

    const cleanedGuess = normalizeWord(currentGuess);

    if (cleanedGuess.length < wordLength) {
      flashMessage(`צריך להזין ${wordLength} אותיות`);
      return;
    }

    if (cleanedGuess.length > wordLength) {
      flashMessage(`המילה צריכה להיות באורך ${wordLength} אותיות`);
      return;
    }

    if (acceptedAnswers.length > 1 && !acceptedAnswers.includes(cleanedGuess)) {
      flashMessage("המילה לא נמצאת ברשימת התשובות האפשריות");
      return;
    }

    const nextGuesses = [...guesses, cleanedGuess];
    setGuesses(nextGuesses);
    setCurrentGuess("");

    if (cleanedGuess === answer) {
      finishGame(true, nextGuesses);
      return;
    }

    if (nextGuesses.length >= maxAttempts) {
      finishGame(false, nextGuesses);
      return;
    }

    setMessage("נסו שוב");
  };

  const addLetter = (letter: string) => {
    if (finished) return;
    setCurrentGuess((prev) => (prev.length < wordLength ? prev + letter : prev));
    inputRef.current?.focus();
  };

  const removeLetter = () => {
    if (finished) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
    inputRef.current?.focus();
  };

  const handleInput = (value: string) => {
    if (finished) return;
    setCurrentGuess(cleanHebrewInput(value).slice(0, wordLength));
  };

  const renderRow = (rowIndex: number) => {
    const solvedRow = evaluatedRows[rowIndex];
    const letters = solvedRow
      ? solvedRow.map((item) => item.letter)
      : rowIndex === guesses.length
        ? currentGuess.split("")
        : [];

    return (
      <div
        key={rowIndex}
        className={`grid gap-1.5 ${rowIndex === guesses.length && wrong ? "animate-shake" : ""}`}
        style={{ gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))` }}
        dir="rtl"
      >
        {Array.from({ length: wordLength }).map((_, letterIndex) => {
          const solvedTile = solvedRow?.[letterIndex];
          const letter = solvedTile?.letter ?? letters[letterIndex] ?? "";
          const state = solvedTile?.state ?? "empty";

          return (
            <div
              key={`${rowIndex}-${letterIndex}`}
              className={`aspect-square min-h-11 max-h-14 border-2 flex items-center justify-center text-2xl sm:text-3xl font-extrabold transition-all duration-300 ${tileClass(state, Boolean(letter))}`}
            >
              {letter}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5" dir="rtl" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        value={currentGuess}
        onChange={(event) => handleInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submitGuess();
          if (event.key === "Backspace" && currentGuess.length === 0) removeLetter();
        }}
        className="sr-only"
        autoComplete="off"
        aria-label="הקלדת ניחוש"
      />

      <div className="bg-white border border-brand-border rounded-2xl p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center border-2 border-[#d3d6da] bg-white text-sm font-black text-[#1a1a1b]">ו</span>
          <h2 className="text-2xl font-black tracking-tight text-[#1a1a1b]">{data.title ?? "וורדעל"}</h2>
        </div>
        {data.description && <p className="text-sm leading-relaxed text-brand-muted">{data.description}</p>}
      </div>

      <div className={`min-h-7 text-center text-sm font-bold ${wrong ? "text-red-600" : "text-brand-text"}`}>
        {message}
      </div>

      <div className="mx-auto w-full max-w-xs space-y-1.5">
        {Array.from({ length: maxAttempts }).map((_, index) => renderRow(index))}
      </div>

      {!finished && (
        <div className="space-y-2 pt-1" aria-label="מקלדת עברית">
          {HEBREW_KEYS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1" dir="rtl">
              {row.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => addLetter(letter)}
                  className={`h-11 min-w-8 rounded-md px-2 text-base font-bold transition-transform active:scale-95 ${keyboardClass(keyboardState[normalizeWord(letter)])}`}
                >
                  {letter}
                </button>
              ))}
            </div>
          ))}

          <div className="flex justify-center gap-1" dir="rtl">
            <button
              type="button"
              onClick={submitGuess}
              className="h-11 rounded-md bg-brand-accent px-4 text-xs font-bold text-white transition-transform active:scale-95"
            >
              בדיקה
            </button>
            <button
              type="button"
              onClick={removeLetter}
              className="h-11 rounded-md bg-[#d3d6da] px-4 text-xs font-bold text-[#1a1a1b] transition-transform active:scale-95"
            >
              מחיקה
            </button>
          </div>
        </div>
      )}

      {finished && (
        <GameResult solved={won} score={score} shareText={shareText} />
      )}
    </div>
  );
}
