import argon2 from "argon2";
import { eq } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./index";
import { colleges, subjects, users } from "./schema";

const COLLEGES = [
  { name: "IIT Delhi", domain: "iitd.ac.in", location: "New Delhi", website: "https://www.iitd.ac.in" },
  { name: "IIT Bombay", domain: "iitb.ac.in", location: "Mumbai", website: "https://www.iitb.ac.in" },
  { name: "NIT Trichy", domain: "nitt.edu", location: "Tiruchirappalli", website: "https://www.nitt.edu" },
  { name: "NIT Warangal", domain: "nitw.ac.in", location: "Warangal", website: "https://www.nitw.ac.in" },
  { name: "BITS Pilani", domain: "pilani.bits-pilani.ac.in", location: "Pilani, Rajasthan", website: "https://www.bits-pilani.ac.in" },
  { name: "VIT Vellore", domain: "vit.ac.in", location: "Vellore", website: "https://www.vit.ac.in" },
  { name: "MIET Jammu", domain: "mietjammu.ac.in", location: "Jammu", website: "https://www.mietjammu.ac.in" },
  { name: "DTU Delhi", domain: "dtu.ac.in", location: "New Delhi", website: "https://www.dtu.ac.in" },
];

const SUBJECTS = [
  { name: "Database Management Systems", code: "CS301", semester: 5 },
  { name: "Operating Systems", code: "CS302", semester: 4 },
  { name: "Data Structures & Algorithms", code: "CS201", semester: 3 },
  { name: "Computer Networks", code: "CS303", semester: 5 },
  { name: "Theory of Computation", code: "CS304", semester: 5 },
  { name: "Compiler Design", code: "CS305", semester: 6 },
  { name: "Machine Learning", code: "CS401", semester: 7 },
  { name: "Software Engineering", code: "CS306", semester: 5 },
  { name: "Digital Electronics", code: "EC201", semester: 3 },
  { name: "Engineering Mathematics II", code: "MA202", semester: 3 },
  { name: "Cloud Computing", code: "CS407", semester: 5 },
  { name: "Mathematics", code: "MA301", semester: 2 },
];

export async function runSeed() {
  const db = await getDb();

  const insertedColleges = await db
    .insert(colleges)
    .values(COLLEGES)
    .onConflictDoNothing()
    .returning({ id: colleges.id, name: colleges.name });
  console.log(`colleges: ${insertedColleges.length} inserted`);

  const allColleges = await db.select({ id: colleges.id }).from(colleges);
  const existingSubjects = await db
    .select({ name: subjects.name })
    .from(subjects);
  const existingNames = new Set(existingSubjects.map((s) => s.name));
  const subjectRows = SUBJECTS.filter((s) => !existingNames.has(s.name)).map(
    (s) => ({ ...s, collegeId: null as string | null }),
  );
  const insertedSubjects = subjectRows.length
    ? await db.insert(subjects).values(subjectRows).returning({ id: subjects.id })
    : [];
  console.log(`subjects: ${insertedSubjects.length} inserted`);

  // Demo student for local development. Documented credentials — not for production.
  const demoEmail = "demo@campusiq.dev";
  const existing = await db.query.users.findFirst?.({
    where: (u, { eq }) => eq(u.email, demoEmail),
  });
  if (!existing) {
    const passwordHash = await argon2.hash("password123", {
      type: argon2.argon2id,
    });
    const college = allColleges[0];
    await db.insert(users).values({
      name: "Demo Student",
      email: demoEmail,
      passwordHash,
      collegeId: college?.id ?? null,
      role: "student",
    });
    console.log(`demo user created: ${demoEmail} / password123`);
  } else {
    console.log("demo user already exists");
  }

  // Admin account for the admin portal (college requests, college management).
  const adminEmail = "admin@campusiq.dev";
  const existingAdmin = await db.query.users.findFirst?.({
    where: (u, { eq }) => eq(u.email, adminEmail),
  });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash("Admin@123456", {
      type: argon2.argon2id,
    });
    await db.insert(users).values({
      name: "CampusIQ Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
    });
    console.log(`admin user created: ${adminEmail} / Admin@123456`);
  } else {
    console.log("admin user already exists");
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runSeed()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
