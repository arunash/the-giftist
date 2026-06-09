import FathersDayQuiz from "./FathersDayQuiz";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find the Perfect Father's Day Gift | Giftist",
  description:
    "Answer 4 quick questions and get 3 personalized Father's Day gift picks in 30 seconds.",
};

export default function QuizPage() {
  return <FathersDayQuiz />;
}
