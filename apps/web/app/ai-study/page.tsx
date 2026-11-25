import { Sparkles } from "lucide-react";
import ComingSoonPage from "../coming-soon";

export default function AIStudyPage() {
  return (
    <ComingSoonPage
      icon={Sparkles}
      title="AI Study"
      tagline="Your personal study copilot, built on shared campus knowledge."
      description="AI Study will turn the resources students share on CampusIQ into personalized study plans, summaries, and practice questions — grounded in real academic material, not generic content."
      bullets={[
        "Generate study plans from subjects and semesters",
        "Summarize notes and PYQs you bookmark",
        "Practice questions derived from shared material",
        "Smart recommendations based on what students upvote",
      ]}
    />
  );
}
