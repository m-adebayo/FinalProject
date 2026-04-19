# AllThingsFitness

AllThingsFitness is a web app where users can get a personalised workout plan and structure their nuttrition better and talk with two chatbots for fitness/nutrition questions.

## What it does

It acts as a one stop fitness site. It builds you a workout based on your goal and fitness level. There are also two chatbots (Freida for fitness and Nardo for nutrition) you can ask stuff.

## Features

- Sign up + log in (passwords hashed with bcrypt, JWT for sessions)
- Profile page where you enter weight, height, age, gender, fitness level, goal
- Workout plan generated from ExerciseDB based on your profile
- Dashboard showing your plan + profile info
- Two chatbots (Freida = fitness coach, Nardo = nutritionist) - uses OpenAI api
- Food page
- Responsive-ish styling (works on laptop, phone is a bit dodgy)

## How to run it

You'll need Node.js (I used v20) and MySQL installed.

**1. Clone the repo**

```
git clone https://github.com/m-adebayo/FinalProject
cd FinalProject
```

**2. Set up the database**

Open MySQL and run:

```sql
CREATE DATABASE fitness_app;
CREATE USER 'fitness_app'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON fitness_app.* TO 'fitness_app'@'localhost';
```

Then run the `createtable.sql` file against the `fitness_app` database:

```
mysql -u fitness_app -p fitness_app < createtable.sql
```

I also added `email VARCHAR(100) UNIQUE` and `password_hash VARCHAR(255)` columns to the users table for login. If you get a column error on signup, add these manually:

```sql
ALTER TABLE users ADD COLUMN email VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
```

**3. Install backend**

```
cd backend
npm install
```

**4. Make a .env file**

Inside the `backend` folder make a file called `.env` with this in it:

```
PORT=5000
RAPIDAPI_KEY=5705828217msh10e334264f8bf02p15deb5jsn5731ddba9a06
RAPIDAPI_HOST=exercisedb.p.rapidapi.com

DB_HOST=localhost
DB_USER=fitness_app
DB_PASSWORD=password
DB_NAME=fitness_app

JWT_SECRET=private
OPENAI_API_KEY= (An OpenAI API key is needed. If needed email @ madeb001@campus.gold.ac.uk for marking)
```

**5. Run it**

```
npm start
```

or

```
npm run dev
```

Then go to `http://localhost:5000` in your browser.

## Dependencies

All installed via `npm install`. The main ones:

- express - server
- mysql2 - database driver
- bcrypt - password hashing
- jsonwebtoken - JWT auth
- dotenv - reads the .env file
- cors - to let frontend talk to backend
- nodemon (dev only) - auto restarts server

Frontend is plain HTML/CSS/JS, no framework.

## Known issues / not done
- The workout page was initially meant to be AI powered, however now it is logically coded
- The food page was initially meant to be similat to the workouts one, with an API however I couldn't find a free "healthy meal" API, so I created a new idea.
- Password reset doesnt exist yet, if you forget it you have to delete the user row from the db
- Chatbots need your own OpenAI key, didnt want to hardcode mine
- Responsiveness isn't the greatest
- No email verification, signup just trusts the email is real 
- Lack of code built testing (manual testing was done)
