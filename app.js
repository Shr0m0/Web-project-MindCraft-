// Import required modules and dependencies
import express from "express";
import bodyParser from "body-parser"; // Middleware
import ejs from "ejs";
import _ from "lodash";
import nodemailer from "nodemailer";
import path from "path";
import bcrypt from 'bcryptjs';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { pool } from './db.js';
import dotenv from 'dotenv';

const homeStartingContent = "Hi Everyone.";
const aboutTitle = "About Me"; 
const contactTitle = "Contact";
const notification = "";

/*
Creating the application structure, including routes, views, and static files.
Setting up the Express.js server and defining the necessary routes.
*/


// Express.js server:
const app = express();
const port = process.env.PORT || 3456; // Use the PORT provided by the environment or default to 3000
dotenv.config();

app.set('view engine', 'ejs');

// Setup session middleware in Database
const pgSessionStore = pgSession(session);

app.use(session({
  store: new pgSessionStore({
    pool: pool, // Use your database connection pool
    tableName: 'sessions' // Name of your existing session table
  }),
  secret: 'thisisauniquesessionsecrete',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Root route to show posts to users
app.get("/", async function(req, res){
  try {
    const result = await pool.query("SELECT * FROM posts");
    const posts = result.rows;
    
    // Determine if user is logged in
    const currentUser = req.session.userId ? true : false;
    
    res.render("home", { posts: posts, currentUser: currentUser });
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).send("Error fetching posts");
  }
});

// User registration page
app.get('/register', (req, res) => {
  const currentUser = req.session.userId ? true : false;
  res.render('register', { message: null, currentUser: currentUser });
});


// User registration endpoint
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user data to the database
    await pool.query('INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)', [username, email, hashedPassword, 'user']);
    
    // Render success message after successful registration
    const currentUser = req.session.userId ? true : false;
    res.redirect(`/login?currentUser=${req.session.userId ? true : false}`);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Error registering user');
  }
});



// Login page route
app.get('/login', (req, res) => {
  const currentUser = req.session.userId ? true : false;
  res.render('login', { currentUser: currentUser });
});


// User login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).send('Email and password are required');
    }

    // Query the database for the user with the provided email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Check if user with the provided email exists
    if (!user) {
      return res.render('login', { message: "Email or password is incorrect" });
    }

    // Compare hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    // Check if password is correct
    if (!passwordMatch) {
      return res.render('login', { message: "Email or password is incorrect" });
    }

    // Store user ID in session
    req.session.userId = user.id;

    // Redirect based on user role
    if (user.is_admin) {
      // Redirect admin to admin dashboard
      res.redirect('/admin/dashboard');
    } else {
      // Redirect regular user to regular dashboard
      res.redirect('/dashboard');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).send('Error logging in');
  }
});


// Logout endpoint
app.get("/logout", function(req, res) {
  // Destroy the session to logout the user
  req.session.destroy(function(err) {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Error logging out");
    }
    // Redirect the user to the login page after logout
    res.redirect("/login");
  });
});



// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send('Unauthorized');
  }
  next();
}

// Regular user dashboard endpoint
app.get("/dashboard", requireAuth, async function(req, res){
  try {
    const userId = req.session.userId; // Get the user ID from the session
    const result = await pool.query("SELECT * FROM posts WHERE user_id = $1", [userId]);
    const posts = result.rows;
    const currentUser = true; // Assuming user is authenticated
    res.render("dashboard", { posts: posts, currentUser: currentUser }); // Pass currentUser to the template
  } catch (err) {
    console.error("Error fetching user's posts:", err);
    res.status(500).send("Error fetching user's posts");
  }
});


// Middleware to require admin privileges
function requireAdmin(req, res, next) {
  // Check if user is admin
  console.log("Checking admin status...");
  if (!req.session.isAdmin) {
    console.log("User is not an admin. Access denied.");
    return res.status(403).send('Forbidden');
  }
  console.log("User is an admin. Access granted.");
  next();
}

// Admin dashboard route
app.get("/admin/dashboard", requireAuth, requireAdmin, async function(req, res){
  console.log("Fetching posts for admin dashboard...");
  try {
    // Fetch all posts from the database
    const result = await pool.query("SELECT * FROM posts");
    const posts = result.rows;
    console.log("Posts fetched successfully.");
    res.render("admin_dashboard", { posts: posts });
  } catch (err) {
    console.error("Error fetching posts for admin dashboard:", err);
    res.status(500).send("Error fetching posts for admin dashboard");
  }
});

// Admin registration endpoint
// Admin registration endpoint
app.post('/admin/register', async (req, res) => {
  const { name, email, password } = req.body;
  const currentUser = req.currentUser;

  try {
    // Check if there is already an admin in the database
    const adminCheck = await pool.query('SELECT * FROM users WHERE role = $1', ['admin']);
    if (adminCheck.rows.length > 0) {
      return res.status(400).send('Admin already registered');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user data to the database with admin role and is_admin set to true
    await pool.query('INSERT INTO users (username, email, password, role, is_admin) VALUES ($1, $2, $3, $4, $5)', [name, email, hashedPassword, 'admin', true]);
    
    // Redirect to the login page after successful registration
    const currentUser = req.session.userId ? true : false;
    res.redirect(`/login?currentUser=${req.session.userId ? true : false}`);
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).send('Error registering admin');
  }
});

// Admin registration endpoint
// Admin registration endpoint
app.post('/admin/register', async (req, res) => {
  const { name, email, password } = req.body;
  const currentUser = req.currentUser;

  try {
    // Check if there is already an admin in the database
    const adminCheck = await pool.query('SELECT * FROM users WHERE role = $1', ['admin']);
    if (adminCheck.rows.length > 0) {
      return res.status(400).send('Admin already registered');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user data to the database with admin role and is_admin set to true
    await pool.query('INSERT INTO users (username, email, password, role, is_admin) VALUES ($1, $2, $3, $4, $5)', [name, email, hashedPassword, 'admin', true]);
    
    // Render success message after successful registration
    res.render('admin_register', { success: 'Admin registered successfully', currentUser: currentUser });
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).send('Error registering admin');
  }
});



// Compose post endpoint
app.get("/compose", requireAuth, async function(req, res){
  // Get the current user
  const currentUser = req.session.userId ? true : false;

  // Render compose post page with currentUser variable
  res.render("compose", { currentUser: currentUser });
});

app.post("/compose", requireAuth, async function(req, res){
  // Handle post composition
  try {
    const userId = req.session.userId; // Get the user ID from the session
    await pool.query("INSERT INTO posts (user_id, subject, title, content) VALUES ($1, $2, $3, $4)", [userId, req.body.postSubject, req.body.postTitle, req.body.postBody]);
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error composing post:", err);
    res.status(500).send("Error composing post");
  }
});

// Define a route handler for GET /posts/:id
app.get("/posts/:id", async (req, res) => {
  const postId = req.params.id; // Extract the value of the "id" parameter

  try {
    // Retrieve the details of the selected post from the database
    const result = await pool.query("SELECT * FROM posts WHERE id = $1", [postId]);
    const post = result.rows[0];

    if (!post) {
      // If the post with the specified ID doesn't exist, return a 404 error
      return res.status(404).send("Post not found");
    }

    // Check if the user is authenticated
    const currentUser = req.session.userId ? true : false;

    // Render a view to display the post content and pass the currentUser variable
    res.render("single-post", { post: post, currentUser: currentUser });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).send("Error fetching post");
  }
});


// Edit post endpoint
app.get("/edit/:postId", requireAuth, async function(req, res) {
  // Define currentUser
  const currentUser = req.session.userId ? true : false;

  // Render edit post page
  const postId = req.params.postId;
  const userId = req.session.userId; // Get the user ID from the session

  try {
    const result = await pool.query("SELECT * FROM posts WHERE id = $1 AND user_id = $2", [postId, userId]);
    const post = result.rows[0];

    if (!post) {
      return res.status(404).send("Post not found or you do not have permission to edit it.");
    }

    res.render("edit", { post: post, currentUser: currentUser });
  } catch (err) {
    console.error("Error fetching post for edit:", err);
    res.status(500).send("Error fetching post for edit");
  }
});


app.post("/edit/:postId", requireAuth, async function(req, res) {
  // Handle post editing
  const postId = req.params.postId;
  const userId = req.session.userId; // Get the user ID from the session

  try {
    await pool.query("UPDATE posts SET subject = $1, title = $2, content = $3 WHERE id = $4 AND user_id = $5", [req.body.postSubject, req.body.postTitle, req.body.postBody, postId, userId]);
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error updating post:", err);
    res.status(500).send("Error updating post");
  }
});

// Delete post endpoint
app.post("/delete/:postId", requireAuth, async function(req, res) {
  // Handle post deletion
  const postId = req.params.postId;
  const userId = req.session.userId; // Get the user ID from the session

  try {
    // Check if the post exists and belongs to the current user
    const result = await pool.query("SELECT * FROM posts WHERE id = $1 AND user_id = $2", [postId, userId]);
    const post = result.rows[0];

    if (!post) {
      // If the post doesn't exist or doesn't belong to the user, return a 404 error
      return res.status(404).send("Post not found or you do not have permission to delete it.");
    }

    // Delete the post from the database
    await pool.query("DELETE FROM posts WHERE id = $1", [postId]);

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).send("Error deleting post");
  }
});


// Contact form endpoint
app.post("/contact", function (req, res) {
  // Handle contact form submission
  const name = req.body.name;
  const email = req.body.email;
  const inquiry = req.body.inquiry;
  const message = req.body.message;

  // Handle the contact form submission
  // This could include sending an email notification, storing the inquiry in the database, etc.

  res.redirect("/"); // Redirect to home page after form submission
});

// Start server and listen for incoming requests
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
