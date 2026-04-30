#define ASIO_STANDALONE
#define CROW_MAIN
#include "crow_all.h"

#include <iostream>
#include <regex>

const std::string base_dir = "Lachooons\\"; // SET YOUR DIRECTORY PATH
const int port_number = 55555;              // SET YOUR PORT NUMBER

std::vector<std::string> music_queue;
double last_known_time = 0.0;
std::mutex mtx;

std::string read_file(const std::string& file_path)
{
    std::ifstream file(file_path);

    if (!file.is_open()) {
        CROW_LOG_INFO << "Could not open the file:" << file_path;
        return "";
    }

    std::stringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

std::string get_json_music_queue()
{
    crow::json::wvalue msg;
    msg["type"] = "QUEUE_UPDATE";
    msg["queue"] = music_queue;
    return msg.dump();
}

std::string youtube_id_cut(const std::string& link)
{
    std::regex pattern(R"((v=|youtu\.be/|shorts/)([^&?/\s]+))");
    std::smatch fit;

    if (std::regex_search(link, fit, pattern) && fit.size() > 2) {
        return fit[2].str();
    }

    return link;
}

int main(int argc, char* argv[])
{
    std::string ROOM_PASSWORD
        = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"; // ENCODE THE PASSWORD TO SHA-256 (PROVIDED: password)

    std::set<crow::websocket::connection*> participants;
    crow::SimpleApp app;

    CROW_WEBSOCKET_ROUTE(app, "/ws")
        .onopen([&](crow::websocket::connection& connection) {
            CROW_LOG_INFO << "New connection - awaiting password...";
            CROW_LOG_INFO << "Hashed Password: " + ROOM_PASSWORD;
        })
        .onclose([&](crow::websocket::connection& connection,
                     const std::string& reason,
                     uint16_t with_status_code) {
            std::lock_guard<std::mutex> _(mtx);
            participants.erase(&connection);
            CROW_LOG_INFO << "A connection has been lost.";
        })
        .onmessage(
            [&](crow::websocket::connection& connection, const std::string& data, bool is_binary) {
                std::lock_guard<std::mutex> _(mtx);

                bool is_authed = (participants.find(&connection) != participants.end());

                auto msg = crow::json::load(data);

                std::string type = msg["type"].s();

                if (!is_authed) {
                    if (type == "AUTH" && msg["hash"].s() == ROOM_PASSWORD) {
                        participants.insert(&connection);
                        CROW_LOG_INFO << "Correct password has been entered - connecting new user.";

                        if (!music_queue.empty()) {
                            crow::json::wvalue welcome_msg;

                            welcome_msg["type"] = "WELCOME";
                            welcome_msg["videoId"] = music_queue[0];
                            welcome_msg["time"] = last_known_time;

                            connection.send_text(welcome_msg.dump());
                            connection.send_text(get_json_music_queue());
                        }
                    } else {
                        CROW_LOG_INFO
                            << "Wrong password has been entered. Closing faulty connection.";
                        connection.close();
                    }

                    return;
                }

                if (type == "HEARTBEAT") {
                    last_known_time = msg["time"].d();
                    return;
                } else if (type == "PAUSE" || type == "SEEK" || type == "PLAY") {
                    for (auto p : participants) {
                        if (p != &connection)
                            p->send_text(data);
                    }
                } else if (type == "SKIP_TRACK") {
                    if (!music_queue.empty()) {
                        music_queue.erase(music_queue.begin());

                        if (!music_queue.empty()) {
                            crow::json::wvalue next_msg;
                            next_msg["type"] = "NEW_TRACK";
                            next_msg["videoId"] = music_queue[0];
                            for (auto p : participants)
                                p->send_text(next_msg.dump());
                        } else {
                            crow::json::wvalue clear_msg;
                            clear_msg["type"] = "CLEAR_PLAYER";
                            for (auto p : participants)
                                p->send_text(clear_msg.dump());
                        }

                        for (auto p : participants)
                            p->send_text(get_json_music_queue());
                    }
                } else if (type == "ADD_TRACK") {
                    std::string clean_id = youtube_id_cut(msg["url"].s());

                    bool was_empty = music_queue.empty();
                    music_queue.push_back(clean_id);

                    if (was_empty) {
                        crow::json::wvalue new_track_msg;
                        new_track_msg["type"] = "NEW_TRACK";
                        new_track_msg["videoId"] = clean_id;

                        for (auto p : participants)
                            p->send_text(new_track_msg.dump());
                    }

                    for (auto p : participants)
                        p->send_text(get_json_music_queue());
                } else if (type == "CHAT") {
                    for (auto p : participants)
                        p->send_text(data);
                }
            });

    CROW_ROUTE(app, "/")([]() {
        crow::response res(read_file(base_dir + "index.html"));
        res.set_header("Content-Type", "text/html; charset=utf-8");

        return res;
    });

    CROW_ROUTE(app, "/style.css")([]() {
        crow::response res(read_file(base_dir + "style.css"));
        res.set_header("Content-Type", "text/css; charset=utf-8");

        return res;
    });

    CROW_ROUTE(app, "/script.js")([]() {
        crow::response res(read_file(base_dir + "script.js"));
        res.set_header("Content-Type", "application/javascript; charset=utf-8");

        return res;
    });

    app.port(port_number).multithreaded().run();
}