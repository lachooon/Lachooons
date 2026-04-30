# Lachooon's - Real Time Listen-Together Room

A lightweight, real-time web application that allows users to watch and listen to Youtube videos in sync

<img width="1630" height="879" alt="lachooons-main-png" src="https://github.com/user-attachments/assets/6d1cf1b0-78d9-4e85-9635-46d77704636b" />

## Why was it created?

Majority of discord bots do not provide support for Youtube videos. The goal was to create an app that would - at least to some extent - replace them with **something**, that plays **exactly** what users want them to.

## Features

* **Real-Time Synchronization:** Play, pause, and seek are synced across all connected clients.
* **Dynamic Video Queue:** Add videos via Youtube URLs, skip tracks, and automatically play next songs in the queue.
* **Chat:** Talk with your friends through built-in chat.
* **Lag protection:** Safeguards against race conditions and other latencies (e.g., during track skipping or track seeking).

## Tech stack

### Backend

* **C++ (C++17/20)**
* **[Crow Framework](https://crowcpp.org)** - serving static files, handling WebSocket communication and JSON data parsing.

### Frontend

* **HTML5 / CSS3**
* **Vanilla JavaScript**
* **Youtube IFrame API**

## Running the server locally

### Prerequisites

* A C++ compiler
* CMake

### Build and run

1. Clone this repository.
2. Change `base_dir`, `port_number`, and `ROOM_PASSWORD` accordingly to your needs.
3. Build the project using your preferred IDE.
4. Run compiled executable.
5. Open your browser and go to `http://localhost:{port_number}`.

*Note: to share the room with your friends over the internet without deploying to a dedicated server, tunnel your localhost port using tools like [ngrok](https://ngrok.com/).*

## Architecture Overview

The app operates on a single WebSocket connetion per client. Every action (i.e. adding a track, pausing, seeking, chatting) sends a JSON payload to the C++ backend, which processes queue logic, updates and internal state, broadcasting the updated JSON payload to all connected peers.
