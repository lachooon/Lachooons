cmake_minimum_required(VERSION 3.14)
project(lachooons LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(lachooons 
    main.cpp
    crow_all.h
    index.html
    favicon.png
    style.css
    script.js



)

if(MINGW)
    target_compile_options(lachooons PRIVATE "-Wa,-mbig-obj")
endif()

target_include_directories(lachooons PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}/include 
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(lachooons PRIVATE ws2_32 mswsock pthread)