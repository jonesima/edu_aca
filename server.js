import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (HTML, JS, CSS)
app.use(express.static(__dirname));

// Example API route (can expand later for teachers/students)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "EduSphere backend running" });
});

// Fallback to register.html for any unknown route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
