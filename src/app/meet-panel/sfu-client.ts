const _EVENTS = {
    onLeave: 'onLeave',
    onJoin: 'onJoin',
    onCreate: 'onCreate',
    onStreamStarted: 'onStreamStarted',
    onStreamEnded: 'onStreamEnded',
    onReady: 'onReady',
    onScreenShareStopped: 'onScreenShareStopped',
    exitRoom: 'exitRoom',
    onConnected: 'onConnected',
    onRemoteTrack: 'onRemoteTrack',
    onMeetingCreated: 'onMeetingCreated'
};

export class SFUClient {
    settings: any;
    _isOpen: any;
    eventListeners: any;
    connection: any;
    consumers: any;
    clients: any;
    localPeer: any;
    localUUID: any;
    localStream: any;
    meetingIdContainer: any;
    username: any;

    constructor(options: any = {}) {
        this.username = options.username;
        console.log(this.username, "options");
        const defaultSettings = {
            port: 4000,
            configuration: {
                iceServers: [
                    { 'urls': 'stun:stun.stunprotocol.org:3478' },
                    { 'urls': 'stun:stun.l.google.com:19302' },
                ]
            }
        };
        this.meetingIdContainer = document.querySelector("#meeting-id")
        this.settings = Object.assign({}, defaultSettings);
        this._isOpen = false;
        this.eventListeners = new Map();
        this.connection = null;
        this.consumers = new Map();
        this.clients = new Map();
        this.localPeer = null;
        this.localUUID = null;
        this.localStream = null;
        Object.keys(_EVENTS).forEach(event => {
            this.eventListeners.set(event, []);
        });

        this.initWebSocket();
        this.trigger(_EVENTS.onReady);
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${protocol}://${window.location.hostname}:${this.settings.port}`;
        this.connection = new WebSocket(url);
        this.connection.onmessage = (data: any) => this.handleMessage(data);
        this.connection.onclose = () => this.handleClose();
        this.connection.onopen = (event: any) => {
            this.trigger(_EVENTS.onConnected, event);
            this._isOpen = true;
        }
    }

    on(event: any, callback: any) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).push(callback);
        }
    }

    trigger(event: any, args: any = null) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach((callback: any) => callback.call(this, args));
        }
    }

    static get EVENTS() {
        return _EVENTS;
    }

    get IsOpen() {
        return this._isOpen;
    }

    findUserVideo(username: any) {
        return document.querySelector(`#remote_${username}`)
    }

    async handleRemoteTrack(stream: any, username: any) {
        const userVideo: any = this.findUserVideo(username);
        if (userVideo) {
            userVideo.srcObject.addTrack(stream.getTracks()[0])
        } else {
            const video = document.createElement('video');
            video.id = `remote_${username}`
            video.srcObject = stream;
            video.autoplay = true;
            // video.muted = (username == this.username);

            const div = document.createElement('div')
            div.id = `user_${username}`;
            div.classList.add('videoWrap')

            const nameContainer = document.createElement('div');
            nameContainer.classList.add('username');
            const textNode = document.createTextNode(username);
            nameContainer.appendChild(textNode);
            div.appendChild(nameContainer);
            div.appendChild(video);
            document.querySelector('.videos-inner')?.appendChild(div);
            const payload = {
                stream,
                username
            }
            this.trigger(_EVENTS.onRemoteTrack, payload)
        }
    }

    async handleIceCandidate({ candidate }: any) {
        if (candidate && candidate.candidate && candidate.candidate.length > 0) {
            const payload = {
                type: 'ice',
                ice: candidate,
                uqid: this.localUUID
            }
            this.connection.send(JSON.stringify(payload));
        }
    }

    handleConsumerIceCandidate(e: any, id: any, consumerId: any) {
        const { candidate } = e;
        if (candidate && candidate.candidate && candidate.candidate.length > 0) {
            const payload = {
                type: 'consumer_ice',
                ice: candidate,
                uqid: id,
                consumerId
            }
            this.connection.send(JSON.stringify(payload));
        }
    }

    handleConsume({ sdp, id, consumerId }: any) {
        const desc = new RTCSessionDescription(sdp);
        this.consumers.get(consumerId).setRemoteDescription(desc).catch((e: any) => console.log(e));
    }

    async createConsumeTransport(peer: any) {
        const consumerId = this.uuidv4();
        const consumerTransport: any = new RTCPeerConnection(this.settings.configuration);
        this.clients.get(peer.id).consumerId = consumerId;
        consumerTransport.id = consumerId;
        consumerTransport.peer = peer;
        this.consumers.set(consumerId, consumerTransport);
        this.consumers.get(consumerId).addTransceiver('video', { direction: "recvonly" })
        this.consumers.get(consumerId).addTransceiver('audio', { direction: "recvonly" })
        const offer = await this.consumers.get(consumerId).createOffer();
        await this.consumers.get(consumerId).setLocalDescription(offer);

        this.consumers.get(consumerId).onicecandidate = (e: any) => this.handleConsumerIceCandidate(e, peer.id, consumerId);

        this.consumers.get(consumerId).ontrack = (e: any) => {
            this.handleRemoteTrack(e.streams[0], peer.username)
        };

        return consumerTransport;
    }

    async consumeOnce(peer: any) {
        const transport = await this.createConsumeTransport(peer);
        const payload = {
            type: 'consume',
            id: peer.id,
            consumerId: transport.id,
            sdp: await transport.localDescription
        }

        this.connection.send(JSON.stringify(payload))
    }

    async handlePeers({ peers }: any) {
        if (peers.length > 0) {
            for (const peer in peers) {
                this.clients.set(peers[peer].id, peers[peer]);
                await this.consumeOnce(peers[peer]);
            }
        }
    }

    handleAnswer({ sdp, meetingId }: any) {
        this.trigger(_EVENTS.onMeetingCreated, meetingId);
        const desc = new RTCSessionDescription(sdp);
        this.localPeer.setRemoteDescription(desc).catch((e: any) => console.log(e));
    }

    async handleNewProducer({ id, username }: any) {
        if (id === this.localUUID) return;

        this.clients.set(id, { id, username });

        await this.consumeOnce({ id, username });
    }

    handleMessage({ data }: any) {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'welcome':
                this.localUUID = message.id;
                break;
            case 'answer':
                this.handleAnswer(message);
                break;
            case 'peers':
                this.handlePeers(message);
                break;
            case 'consume':
                this.handleConsume(message)
                break
            case 'newProducer':
                this.handleNewProducer(message);
                break;
            case 'user_left':
                this.removeUser(message);
                break;
            case 'meeting-exists':
                this.handleMeetingJoin(message);
                break;
        }
    }

    handleMeetingJoin(message: any) {
        if (message.isMeetingExist) {
            this.connect(message.meetingId);
        } else {
            alert("Meeting doesn't exists");
            window.location.replace("/");
        }
    }


    removeUser({ id }: any) {
        const { username, consumerId } = this.clients.get(id);
        this.consumers.delete(consumerId);
        this.clients.delete(id);
        //@ts-ignore
        document.querySelector(`#remote_${username}`)?.srcObject?.getTracks().forEach((track: any) => track.stop());
        document.querySelector(`#user_${username}`)?.remove();
    }

    async connect(meetingId?: any) { //Produce media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        this.handleRemoteTrack(stream, this.username)
        this.localStream = stream;

        this.localPeer = this.createPeer(meetingId);
        this.localStream.getTracks().forEach((track: any) => this.localPeer.addTrack(track, this.localStream));
        await this.subscribe();
    }

    createPeer(meetingId?: any) {
        this.localPeer = new RTCPeerConnection(this.settings.configuration);
        this.localPeer.onicecandidate = (e: any) => this.handleIceCandidate(e);
        //peer.oniceconnectionstatechange = checkPeerConnection;
        this.localPeer.onnegotiationneeded = () => this.handleNegotiation(meetingId);
        return this.localPeer;
    }

    async subscribe() { // Consume media
        await this.consumeAll();
    }

    async consumeAll() {
        const payload = {
            type: 'getPeers',
            uqid: this.localUUID,
        }

        this.connection.send(JSON.stringify(payload));
    }

    async handleNegotiation(meetingId?: any) {
        console.log('*** negoitating ***')
        const offer = await this.localPeer.createOffer();
        await this.localPeer.setLocalDescription(offer);

        const payload: any = {
            type: 'connect',
            sdp: this.localPeer.localDescription,
            uqid: this.localUUID,
            username: this.username,
        }
        if (meetingId) {
            payload["meetingId"] = meetingId;
        }

        this.connection.send(JSON.stringify(payload));
    }

    handleClose() {
        this.connection = null;
        if(this.localStream) {
            this.localStream.getTracks().forEach((track: any) => track.stop());
        }
        this.clients = null;
        this.consumers = null;
    }


    uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    joinMeeting(meetingId: any) {
        const payload = { type: 'join-meeting', meetingId }
        this.connection.send(JSON.stringify(payload));
    }

    toggleLocalMic() {
        const localMicTrack = this.localStream.getTracks().find((track: any) => track.kind === 'audio');
        localMicTrack.enabled = !localMicTrack.enabled;
        return localMicTrack.enabled;
    }

    toggleLocalVideo() {
        const localVideoTrack = this.localStream.getTracks().find((track: any) => track.kind === 'video');
        localVideoTrack.enabled = !localVideoTrack.enabled;
        return localVideoTrack.enabled;
      }
}