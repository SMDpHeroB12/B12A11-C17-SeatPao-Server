# SeatPao

SeatPao is a full-stack online ticket booking platform where users can browse, book, and manage transport tickets seamlessly.  
The platform supports multiple user roles such as **User**, **Vendor**, and **Admin**, each with dedicated dashboards and functionalities.

---

## 🔗 Live Website

- **Client Side Live URL:**  
  https://seatpao-b12a11c17.web.app

- **Server Side Live URL:**  
  https://seat-pao-server.vercel.app

---

## 📦 GitHub Repository

- **Client Side Repository:**  
  https://github.com/SMDpHeroB12/B12A11-C17-SeatPao-Client.git

---

## Project Purpose

The main goal of SeatPao is to provide a secure and user-friendly ticket booking system where:

- Users can easily find and book tickets
- Vendors can manage and sell their tickets
- Admins can control users, tickets, advertisements, and platform integrity

This project is built as part of the **Programming Hero Web Development Assignment (B12A11 – Category 17)**.

---

## Key Features

### 👤 Authentication & Authorization

- Firebase Authentication (Email/Password & Google Login)
- Role-based access control (User, Vendor, Admin)

### 🎟️ Ticket Management

- Vendors can add, update, and delete tickets
- Admin approval system for tickets
- Fraud detection: Admin can mark vendors as fraud
- Fraud vendors cannot add tickets and their tickets are hidden

### 🏠 Home Page

- Hero banner / slider
- Advertisement section (Admin-selected 6 tickets)
- Latest tickets section (recently added tickets)
- Smooth UI animations using Framer Motion

### 🔍 Ticket Browsing

- Search tickets by **From → To location**
- Filter tickets by **transport type**
- Sort tickets by **price (Low to High / High to Low)**
- Pagination for better performance and UX

### 🧾 Booking System

- Auto ticket booking creation
- User booking history (My Bookings)
- Countdown timer for ticket departure
- Ticket cards with image and full details

### 📰 Dashboards

#### Admin Dashboard

- Total users, tickets, bookings, revenue
- Manage users (make admin, vendor, mark fraud)
- Manage tickets & advertisements

#### Vendor Dashboard

- Vendor-specific ticket stats
- Booking count and revenue
- Recently added tickets overview

### Additional Feature

- Fully responsive design for mobile, tablet, and desktop.

---

## 🛠️ Technologies Used

### Frontend

- React
- React Router DOM
- Firebase Authentication
- Framer Motion
- Tailwind CSS
- DaisyUI
- React Hot Toast

### Backend

- Node.js
- Express.js
- MongoDB
- CORS
- dotenv

### Deployment

- Firebase Hosting (Client)
- Vercel (Server)

---

## NPM Packages Used

### Client Side

- react
- react-router-dom
- firebase
- framer-motion
- react-hot-toast
- react-icons

### Server Side

- express
- mongodb
- cors
- dotenv

---

## 🧑‍💻 Developer

**Name:** SHEKH MD NAYEM YOUSUF
**Batch:** Programming Hero – Batch 12  
**Assignment:** B12A11 – Category 17
**Student ID:** WEB12-0683

---

⭐ If you like this project, feel free to give it a star on GitHub!
