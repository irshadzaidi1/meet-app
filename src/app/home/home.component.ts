import { Component, OnInit, inject } from '@angular/core';
import { Firestore, collectionData, collection, onSnapshot, doc, setDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';




@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  item$?: Observable<any[]>;
  firestore: Firestore = inject(Firestore);

  // DEfault configuration - Change these if you have a different STUN or TURN server.
  configuration = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  };
  localStream: any;
  remoteStream: any;
  peerConnection: any;
  roomId: any;

  constructor() {
    const itemCollection = collection(this.firestore, 'rooms');
    this.item$ = collectionData(itemCollection);
  }

  // async joinRoomById(roomId: any) {
  //   const db = firebase.firestore();
  //   const roomRef = db.collection('rooms').doc(`${roomId}`);
  //   const roomSnapshot = await roomRef.get();
  //   console.log('Got room:', roomSnapshot.exists);
  
  //   if (roomSnapshot.exists) {
  //     this.peerConnection = new RTCPeerConnection(this.configuration);
  //     this.registerPeerConnectionListeners();
  //     this.localStream.getTracks().forEach((track: any) => {
  //       this.peerConnection.addTrack(track, this.localStream);
  //     });
  
  //     // Code for collecting ICE candidates below
  //     this.collectIceCandidates(roomRef, this.peerConnection,'localName', 'remoteName')
  //     // Code for collecting ICE candidates above
  
  //     this.peerConnection.addEventListener('track', (event: any) => {
  //       console.log('Got remote track:', event.streams[0]);
  //       event.streams[0].getTracks().forEach((track: any) => {
  //         console.log('Add a track to the remoteStream:', track);
  //         this.remoteStream.addTrack(track);
  //       });
  //     });
  //   }
  // }

  async collectIceCandidates(roomRef: any, peerConnection: any, localName: any, remoteName: any) {
    const candidatesCollection = roomRef.collection(localName);
    
    peerConnection.addEventListener('icecandidate', (event: any) => {
    if (event.candidate) {
      const json = event.candidate.toJSON();
      candidatesCollection.add(json);
    }
    });
    roomRef.collection(remoteName).onSnapshot((snapshot: any) => {
      snapshot.docChanges().forEach((change: any) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    })
  }

  async openUserMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true, audio: true
    });
    this.localStream = stream;
    // document.querySelector('#localVideo').srcObject = stream;
    // localStream = stream;
    // remoteStream = new MediaStream();
    // document.querySelector('#remoteVideo').srcObject = remoteStream;

    // console.log('Stream:', document.querySelector('#localVideo').srcObject);
    // document.querySelector('#cameraBtn').disabled = true;
    // document.querySelector('#joinBtn').disabled = false;
    // document.querySelector('#createBtn').disabled = false;
    // document.querySelector('#hangupBtn').disabled = false;
  }

  async hangUp() {
    const localTracks = this.localStream && this.localStream.getTracks();
    (localTracks || []).forEach((track: any) => track.stop());

    const remoteTracks = this.remoteStream && this.remoteStream.getTracks();
    (remoteTracks || []).forEach((track: any) => track.stop());
  
    this.peerConnection && this.peerConnection.close();
  
    // document.querySelector('#localVideo').srcObject = null;
    // document.querySelector('#remoteVideo').srcObject = null;
    // document.querySelector('#cameraBtn').disabled = false;
    // document.querySelector('#joinBtn').disabled = true;
    // document.querySelector('#createBtn').disabled = true;
    // document.querySelector('#hangupBtn').disabled = true;
    // document.querySelector('#currentRoom').innerText = '';
  
    // Delete room on hangup
    if (this.roomId) {
      // const db = firebase.firestore();
      // const roomRef = db.collection('rooms').doc(this.roomId);
      // const calleeCandidates = await roomRef.collection('calleeCandidates').get();
      // calleeCandidates.forEach(async candidate => {
      //   await candidate.delete();
      // });
      // const callerCandidates = await roomRef.collection('callerCandidates').get();
      // callerCandidates.forEach(async candidate => {
      //   await candidate.delete();
      // });
      // await roomRef.delete();
    }
  
    document.location.reload();
  }

  async createRoom() {
    this.peerConnection = new RTCPeerConnection(this.configuration);
    this.registerPeerConnectionListeners();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    const roomWithOffer = {
        offer: {
            type: offer.type,
            sdp: offer.sdp
        }
    }
    const roomRef = doc(collection(this.firestore, "rooms"));
    await setDoc(roomRef, roomWithOffer);
    this.roomId = roomRef.id;
    onSnapshot(collection(this.firestore, "rooms"), {}, async (snapshot: any) => {
      const data: any = [];
      snapshot.docs.forEach((doc: any) => {
        data.push(doc.data());
      });
      if (!this.peerConnection.currentRemoteDescription && snapshot.answer) {
          console.log('Set remote description: ', data.answer);
          const answer = new RTCSessionDescription(data.answer)
          await this.peerConnection.setRemoteDescription(answer);
      }
    });
    
    this.localStream.getTracks().forEach((track: any) => {
      this.peerConnection.addTrack(track, this.localStream);
    });
  
    this.peerConnection.addEventListener('track', (event: any) => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach((track: any) => {
        console.log('Add a track to the remoteStream:', track);
        this.remoteStream.addTrack(track);
      });
    });
  }

  registerPeerConnectionListeners() {
    this.peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log(
          `ICE gathering state changed: ${this.peerConnection.iceGatheringState}`);
    });
  
    this.peerConnection.addEventListener('connectionstatechange', () => {
      console.log(`Connection state change: ${this.peerConnection.connectionState}`);
    });
  
    this.peerConnection.addEventListener('signalingstatechange', () => {
      console.log(`Signaling state change: ${this.peerConnection.signalingState}`);
    });
  
    this.peerConnection.addEventListener('iceconnectionstatechange ', () => {
      console.log(
          `ICE connection state change: ${this.peerConnection.iceConnectionState}`);
    });
  }

  ngOnInit(): void {

  }

}
