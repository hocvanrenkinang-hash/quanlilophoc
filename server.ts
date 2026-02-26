import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("classroom.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    name TEXT NOT NULL,
    tuition_rate INTEGER DEFAULT 0, -- Price per session
    planned_sessions INTEGER DEFAULT 8, -- Expected sessions for the month
    FOREIGN KEY (class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT NOT NULL,
    status TEXT, -- 'present', 'absent'
    camera INTEGER, -- 0 or 1
    homework INTEGER, -- 0 or 1
    test_score TEXT,
    test_comment TEXT,
    comment TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`);

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/classes", (req, res) => {
    const classes = db.prepare("SELECT * FROM classes").all();
    res.json(classes);
  });

  app.post("/api/classes", (req, res) => {
    const { name } = req.body;
    const info = db.prepare("INSERT INTO classes (name) VALUES (?)").run(name);
    res.json({ id: info.lastInsertRowid, name });
  });

  app.get("/api/classes/:classId/students", (req, res) => {
    const students = db.prepare("SELECT * FROM students WHERE class_id = ?").all(req.params.classId);
    res.json(students);
  });

  app.post("/api/students", (req, res) => {
    const { class_id, name, tuition_rate, planned_sessions } = req.body;
    const info = db.prepare("INSERT INTO students (class_id, name, tuition_rate, planned_sessions) VALUES (?, ?, ?, ?)").run(class_id, name, tuition_rate || 0, planned_sessions || 8);
    res.json({ id: info.lastInsertRowid, class_id, name, tuition_rate: tuition_rate || 0, planned_sessions: planned_sessions || 8 });
  });

  app.patch("/api/students/:id", (req, res) => {
    const { tuition_rate, planned_sessions } = req.body;
    if (tuition_rate !== undefined) {
      db.prepare("UPDATE students SET tuition_rate = ? WHERE id = ?").run(tuition_rate, req.params.id);
    }
    if (planned_sessions !== undefined) {
      db.prepare("UPDATE students SET planned_sessions = ? WHERE id = ?").run(planned_sessions, req.params.id);
    }
    res.json({ success: true });
  });

  app.get("/api/records/monthly", (req, res) => {
    const { month, class_id } = req.query; // month format: YYYY-MM
    const records = db.prepare(`
      SELECT r.*, s.name as student_name, s.tuition_rate
      FROM records r
      JOIN students s ON r.student_id = s.id
      WHERE r.date LIKE ? AND s.class_id = ?
    `).all(`${month}%`, class_id);
    res.json(records);
  });

  app.get("/api/records", (req, res) => {
    const { date, class_id } = req.query;
    const records = db.prepare(`
      SELECT r.*, s.name as student_name 
      FROM records r
      JOIN students s ON r.student_id = s.id
      WHERE r.date = ? AND s.class_id = ?
    `).all(date, class_id);
    res.json(records);
  });

  app.post("/api/records", (req, res) => {
    const { student_id, date, status, camera, homework, test_score, test_comment, comment } = req.body;
    
    // Check if record exists
    const existing = db.prepare("SELECT id FROM records WHERE student_id = ? AND date = ?").get(student_id, date);
    
    if (existing) {
      db.prepare(`
        UPDATE records 
        SET status = ?, camera = ?, homework = ?, test_score = ?, test_comment = ?, comment = ?
        WHERE id = ?
      `).run(status, camera, homework, test_score, test_comment, comment, existing.id);
      res.json({ id: existing.id, success: true });
    } else {
      const info = db.prepare(`
        INSERT INTO records (student_id, date, status, camera, homework, test_score, test_comment, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(student_id, date, status, camera, homework, test_score, test_comment, comment);
      res.json({ id: info.lastInsertRowid, success: true });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
