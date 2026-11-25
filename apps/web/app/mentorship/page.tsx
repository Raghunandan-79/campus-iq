import { Users } from "lucide-react";
import ComingSoonPage from "../coming-soon";

export default function MentorshipPage() {
  return (
    <ComingSoonPage
      icon={Users}
      title="Mentorship"
      tagline="Learn from students one semester ahead of you."
      description="Mentorship will connect you with seniors and peers for guidance on coursework, exam preparation, placements, and campus life — based on real experience, not anonymous forums."
      bullets={[
        "Find mentors by college, course, and semester",
        "Ask questions about academics and placements",
        "Book one-on-one guidance sessions",
        "Give back by mentoring juniors",
      ]}
    />
  );
}
