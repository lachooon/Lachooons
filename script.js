let player;
let server;

let pauseSynchron = false;
let isSkipping = false;

let titleCache = {};

let chatNickname = "Guest";
let chatColor = "#2793e8";

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: 'dQw4w9WgXcQ',
        playerVars: { 'autoplay': 0, 'rel': 0 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function showPlayer() {
    document.getElementById('welcome-screen').style.display = 'none';
    const pc = document.getElementById('player-container');
    pc.style.display = 'block';
    pc.style.position = 'relative';
    pc.style.left = '0';
    pc.style.opacity = '1';
    pc.style.width = '100%';
    pc.style.height = '100%';
}

function hidePlayer() {
    if (player && typeof player.stopVideo === 'function') {
        player.stopVideo();
    }

    document.getElementById('welcome-screen').style.display = 'block';

    document.getElementById('player-container').style.display = 'none';
}

async function hashPassword(haslo) {
    const encoder = new TextEncoder();
    const data = encoder.encode(haslo);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function onPlayerReady(event) {
    const rawPassword = prompt("Enter the room's password:");
    if (!rawPassword) {
        alert("Incorrect password. Disconnecting...");
        return;
    }

    const hashedPassword = await hashPassword(rawPassword);
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    server = new WebSocket(protocol + window.location.host + "/ws");

    server.onopen = function() {
        server.send(JSON.stringify({ type: "AUTH", hash: hashedPassword }));
    };

    server.onclose = function() { alert("Disconnected from the server"); };

    server.onmessage = function(event) {
        const msg = JSON.parse(event.data);

        if (msg.type === "PLAY") {
            pauseSynchron = true;
            player.seekTo(msg.time, true);
            player.playVideo();
            setTimeout(() => { pauseSynchron = false; }, 500);
        } else if (msg.type === "PAUSE") {
            pauseSynchron = true;
            player.pauseVideo();
            player.seekTo(msg.time, true);
            setTimeout(() => { pauseSynchron = false; }, 500);
        } else if (msg.type === "NEW_TRACK") {
            pauseSynchron = true;

            showPlayer();
            player.loadVideoById(msg.videoId);

            setTimeout(() => { pauseSynchron = false; }, 1500);
        } else if (msg.type === "WELCOME") {
            pauseSynchron = true;
            showPlayer();
            player.loadVideoById({ 'videoId': msg.videoId, 'startSeconds': msg.time });
            setTimeout(() => { pauseSynchron = false; }, 500);
        } else if (msg.type === "QUEUE_UPDATE") {
            renderQueue(msg.queue);
        } else if (msg.type === "CLEAR_PLAYER") {
            hidePlayer();
            pauseSynchron = false;
        } else if (msg.type === "CHAT") {
            const chatBox = document.getElementById('chat-messages');
            const msgColor = msg.color || "#2793e8";

            const msgDiv = document.createElement('div');
            msgDiv.innerHTML = `<strong style="color: ${msgColor};">${msg.author}:</strong> <span style="color: #eee;">${msg.content}</span>`;

            chatBox.appendChild(msgDiv);

            chatBox.scrollTop = chatBox.scrollHeight;
        }
    };

    setInterval(() => {
        if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
            server.send(JSON.stringify({ type: "HEARTBEAT", time: player.getCurrentTime() }));
        }
    }, 2000);
}

function onPlayerStateChange(event) {
    if (pauseSynchron) return;
    if (event.data === YT.PlayerState.PLAYING) {
        server.send(JSON.stringify({ type: "PLAY", time: player.getCurrentTime() }));
    } else if (event.data === YT.PlayerState.PAUSED) {
        server.send(JSON.stringify({ type: "PAUSE", time: player.getCurrentTime() }));
    } else if (event.data === YT.PlayerState.ENDED) {
        server.send(JSON.stringify({ type: "SKIP_TRACK" }));
    }
}

function sendUrl() {
    const input = document.getElementById('yt-link');
    const link = input.value;
    if (link.trim() !== "" && server && server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({ type: "ADD_TRACK", url: link }));
        input.value = "";
    }
}

function skipTrack() {
    if (isSkipping) return;

    if (server && server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({ type: "SKIP_TRACK" }));

        isSkipping = true;
        setTimeout(() => { isSkipping = false }, 1000);
    }
}

function renderQueue(musicIds) {
    const contener = document.getElementById('track-list');

    contener.innerHTML = '';

    if (!musicIds || musicIds.length === 0) {
        contener.innerHTML = '<p style="color: #666; font-size: 14px; width: 100%; text-align: center; margin: auto;">No tracks</p>';
        return;
    }

    musicIds.forEach((id, index) => {
        const element = document.createElement('div');

        element.style = "flex: 0 0 110px; width: 110px; height: 62px; position: relative; cursor: pointer; transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 1;";

        element.title = "Wczytywanie tytułu...";

        element.onmouseover = () => {
            element.style.transform = "scale(1.2)";
            element.style.zIndex = "10";
        };
        element.onmouseout = () => {
            element.style.transform = "scale(1)";
            element.style.zIndex = "1";
        };

        const thumbnail = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

        element.innerHTML = `
            <img src="${thumbnail}" style="width: 100%; height: 100%; border-radius: 8px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
            <span style="position: absolute; bottom: 5px; right: 5px; background: rgba(0,0,0,0.85); color: white; font-size: 11px; padding: 2px 5px; border-radius: 4px; font-weight: bold;">
                #${index + 1}
            </span>
        `;

        contener.appendChild(element);

        if (titleCache[id]) {
            element.title = titleCache[id];
        } else {
            fetch(`https://noembed.com/embed?dataType=json&url=https://www.youtube.com/watch?v=${id}`)
                .then(response => response.json())
                .then(apiData => {
                    if (apiData.title) {
                        titleCache[id] = apiData.title;
                        element.title = apiData.title;
                    } else {
                        element.title = `Track ID: ${id}`;
                    }
                }).catch(err => {
                    element.title = `Track ID: ${id}`;
                });
        }
    });
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (text !== "" && server && server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({
            type: "CHAT",
            author: chatNickname,
            color: chatColor,
            content: text
        }));

        input.value = "";
    }
}

function openIdentityModal() {
    document.getElementById('identity-modal').style.display = "flex";
    document.getElementById('nick-input').value = chatNickname;
    document.getElementById('color-input').value = chatColor;
    updatePreview();
}

function closeIdentityModal() {
    document.getElementById('identity-modal').style.display = "none";
}

function updatePreview() {
    const nick = document.getElementById('nick-input').value || "Guest";
    const color = document.getElementById('color-input').value;
    const preview = document.getElementById('identity-preview');
    preview.innerText = nick;
    preview.style.color = color;
}

function saveIdentity() {
    chatNickname = document.getElementById('nick-input').value.trim() || "Guest";
    chatColor = document.getElementById('color-input').value;
    closeIdentityModal();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chat-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') sendChatMessage();
    });

    const trackList = document.getElementById('track-list');
    trackList.addEventListener('wheel', function (e) {
        if (e.deltaY !== 0) {
            e.preventDefault();

            trackList.scrollBy({ left: e.deltaY, behavior: 'smooth' });
        }
    });
});