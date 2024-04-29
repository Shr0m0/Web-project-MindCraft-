CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  subject VARCHAR(200) NOT NULL,
  title VARCHAR(300) NOT NULL,
  content VARCHAR(1000) NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
);


CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) UNIQUE NOT NULL
);


CREATE TABLE user_roles (
  user_id INT REFERENCES users(id),
  role_id INT REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);




-- INSERT INTO posts (subject, title, content) VALUES ('Fitness', 'How to get fit', 'Eat healthy and exercise');


ALTER TABLE posts ALTER COLUMN content TYPE character varying(2000);


ALTER TABLE posts
ADD COLUMN user_id INTEGER;


ALTER TABLE sessions
ADD CONSTRAINT pk_sessions_sid PRIMARY KEY (sid);


ALTER TABLE sessions ADD PRIMARY KEY (id);


ALTER TABLE users ADD CONSTRAINT email_unique UNIQUE (email);


