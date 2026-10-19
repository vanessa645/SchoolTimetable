
require('dotenv').config();

const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_PATH || './school_timetable.db';

// Connect to the existing SQLite database.
// This preserves the existing timetable records.
const db = new Database(
    path.resolve(__dirname, DB_FILE)
);

// Create the table if it does not already exist.
db.exec(`
    CREATE TABLE IF NOT EXISTS timetable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        subject TEXT NOT NULL,
        teacher TEXT NOT NULL,
        class_name TEXT NOT NULL,
        classroom TEXT NOT NULL
    )
`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Validate a record ID.
function getValidId(id) {
    const number = Number(id);

    if (!Number.isInteger(number) || number <= 0) {
        return null;
    }

    return number;
}

// Validate timetable fields.
function validateLesson(body) {
    const fields = [
        'day',
        'start_time',
        'end_time',
        'subject',
        'teacher',
        'class_name',
        'classroom'
    ];

    for (const field of fields) {
        if (
            typeof body[field] !== 'string' ||
            body[field].trim() === ''
        ) {
            return `Please provide a valid ${field.replaceAll('_', ' ')}.`;
        }
    }

    if (body.start_time >= body.end_time) {
        return 'End time must be later than start time.';
    }

    const validDays = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
    ];

    if (!validDays.includes(body.day)) {
        return 'Please select a valid day.';
    }

    return null;
}

// Return all timetable lessons.
app.get('/api/timetable', (req, res) => {
    try {
        const lessons = db.prepare(`
            SELECT *
            FROM timetable
            ORDER BY
                CASE day
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                    WHEN 'Saturday' THEN 6
                    WHEN 'Sunday' THEN 7
                    ELSE 8
                END,
                start_time
        `).all();

        res.json(lessons);
    } catch (error) {
        console.error('Get timetable error:', error.message);
        res.status(500).json({
            error: 'Failed to retrieve timetable.'
        });
    }
});

// Return one timetable lesson by ID.
app.get('/api/timetable/:id', (req, res) => {
    const id = getValidId(req.params.id);

    if (id === null) {
        return res.status(400).json({
            error: 'Please provide a valid lesson ID.'
        });
    }

    try {
        const lesson = db.prepare(
            'SELECT * FROM timetable WHERE id = ?'
        ).get(id);

        if (!lesson) {
            return res.status(404).json({
                error: 'Lesson not found.'
            });
        }

        res.json(lesson);
    } catch (error) {
        console.error('Get lesson error:', error.message);
        res.status(500).json({
            error: 'Failed to retrieve lesson.'
        });
    }
});

// Create a timetable lesson.
app.post('/api/timetable', (req, res) => {
    const validationError = validateLesson(req.body);

    if (validationError) {
        return res.status(400).json({
            error: validationError
        });
    }

    const {
        day,
        start_time,
        end_time,
        subject,
        teacher,
        class_name,
        classroom
    } = req.body;

    try {
        const result = db.prepare(`
            INSERT INTO timetable (
                day,
                start_time,
                end_time,
                subject,
                teacher,
                class_name,
                classroom
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            day,
            start_time,
            end_time,
            subject.trim(),
            teacher.trim(),
            class_name.trim(),
            classroom.trim()
        );

        const lesson = db.prepare(
            'SELECT * FROM timetable WHERE id = ?'
        ).get(Number(result.lastInsertRowid));

        res.status(201).json({
            message: 'Lesson added successfully.',
            lesson
        });
    } catch (error) {
        console.error('Create lesson error:', error.message);
        res.status(500).json({
            error: 'Failed to add lesson.'
        });
    }
});

// Update an existing timetable lesson.
app.put('/api/timetable/:id', (req, res) => {
    const id = getValidId(req.params.id);

    if (id === null) {
        return res.status(400).json({
            error: 'Please provide a valid lesson ID.'
        });
    }

    const validationError = validateLesson(req.body);

    if (validationError) {
        return res.status(400).json({
            error: validationError
        });
    }

    const {
        day,
        start_time,
        end_time,
        subject,
        teacher,
        class_name,
        classroom
    } = req.body;

    try {
        const result = db.prepare(`
            UPDATE timetable
            SET
                day = ?,
                start_time = ?,
                end_time = ?,
                subject = ?,
                teacher = ?,
                class_name = ?,
                classroom = ?
            WHERE id = ?
        `).run(
            day,
            start_time,
            end_time,
            subject.trim(),
            teacher.trim(),
            class_name.trim(),
            classroom.trim(),
            id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                error: 'Lesson not found.'
            });
        }

        const lesson = db.prepare(
            'SELECT * FROM timetable WHERE id = ?'
        ).get(id);

        res.json({
            message: 'Lesson updated successfully.',
            lesson
        });
    } catch (error) {
        console.error('Update lesson error:', error.message);
        res.status(500).json({
            error: 'Failed to update lesson.'
        });
    }
});

// Delete a timetable lesson.
app.delete('/api/timetable/:id', (req, res) => {
    const id = getValidId(req.params.id);

    if (id === null) {
        return res.status(400).json({
            error: 'Please provide a valid lesson ID.'
        });
    }

    try {
        const result = db.prepare(
            'DELETE FROM timetable WHERE id = ?'
        ).run(id);

        if (result.changes === 0) {
            return res.status(404).json({
                error: 'Lesson not found.'
            });
        }

        res.json({
            message: 'Lesson deleted successfully.',
            id
        });
    } catch (error) {
        console.error('Delete lesson error:', error.message);
        res.status(500).json({
            error: 'Failed to delete lesson.'
        });
    }
});

// Return JSON for unknown API routes.
app.use('/api', (req, res) => {
    res.status(404).json({
        error: 'API endpoint not found.'
    });
});

// Start the server.
app.listen(PORT, () => {
    console.log(
        `School Timetable app running at http://localhost:${PORT}`
    );
});

// Close the database cleanly when the process exits.
function closeDatabase() {
    if (db.open) {
        db.close();
    }
}

process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeDatabase();
    process.exit(0);
});
