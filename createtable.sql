CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    weight FLOAT,
    height FLOAT,
    age INT,
    gender ENUM('male','female','other'),
    fitness_level ENUM('beginner','intermediate','advanced'),
    goal ENUM('lose_weight','build_muscle','maintain','endurance')
);

CREATE TABLE user_dietary_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    preference VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_medical_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    flag VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE workout_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    plan_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);