import { Component, OnInit, inject } from '@angular/core';
import { Firestore, collectionData, collection, onSnapshot, doc, setDoc, addDoc, getDoc, docData, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router'; 


@Component({
  selector: 'app-meet-panel',
  templateUrl: './meet-panel.component.html',
  styleUrls: ['./meet-panel.component.scss']
})
export class MeetPanelComponent implements OnInit {
  meetingCode: string = '';
  isLocalCamOn: boolean = true;
  isLocalMicOn: boolean = true;


  item$?: Observable<any[]>;
  firestore: Firestore = inject(Firestore);
  isMuted: boolean = false;

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
    iceCandidatePoolSize: 20,
  };
  localStream: any;
  remoteStream: any = [];
  peerConnection: any;
  roomId: any;
  meetingId: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {
    const itemCollection = collection(this.firestore, 'rooms');
    this.item$ = collectionData(itemCollection);
  }

  joinRoomById = async (roomId: any) => {
    const roomRef = doc(collection(this.firestore, 'rooms'), roomId);
    const roomSnapshot = await getDoc(roomRef);
  
    if (roomSnapshot.exists()) {
      this.peerConnection = new RTCPeerConnection(this.configuration);
      this.registerPeerConnectionListeners();
      this.localStream.getTracks().forEach((track: any) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
  
      // Code for collecting ICE candidates below
      const calleeCandidatesCollection = collection(roomRef, ('calleeCandidates'));
      this.peerConnection.addEventListener('icecandidate', (event: any) => {
        if (!event.candidate) {
          console.log('Got final candidate!');
          return;
        }
        addDoc(calleeCandidatesCollection, event.candidate.toJSON());
      });
      // Code for collecting ICE candidates above
  
      this.peerConnection.addEventListener('track', (event: any) => {
        console.log('Got remote track:', event.streams[0], event.streams);
        this.remoteStream = (event.streams || []).map((stream: any) => {
          const rmStream = new MediaStream();
          stream.getTracks().forEach((track: any) => {
            rmStream.addTrack(track);
          });
          return rmStream;
        });
        // event.streams[0].getTracks().forEach((track: any) => {
        //   this.remoteStream.addTrack(track);
        // });
      });
  
      // Code for creating SDP answer below
      const offer = roomSnapshot.data()['offer'];
      console.log('Got offer:', offer);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      console.log('Created answer:', answer);
      await this.peerConnection.setLocalDescription(answer);
      const allAnswer = roomSnapshot.data()['answer'] || [];

  
      const roomWithAnswer = {
        answer: [
          ...allAnswer,
          { type: answer.type, sdp: answer.sdp }
        ],
      };
      await updateDoc(roomRef, roomWithAnswer);
      // Code for creating SDP answer above
  
      // Listening for remote ICE candidates below
      onSnapshot(collection(roomRef, 'callerCandidates'),(snapshot: any) => {
        snapshot.docChanges().forEach(async (change: any) => {
          if (change.type === 'added') {
            let data = change.doc.data();
            console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
      // Listening for remote ICE candidates above
    } else {
      alert("Invalid meeeting.");
      document.location.replace('/');
    }
  }

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

  async openUserMedia(meetingId: string = '') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      this.localStream = stream;
      meetingId ? this.joinRoomById(meetingId) : this.createRoom();
    } catch(err: any) {
      if (err.name === "NotAllowedError") {
        this.router.navigate(['/'])
        alert("Please give Camera and Audio Permission")
      }
    }
  }

  async leave() {
    const localTracks = this.localStream && this.localStream.getTracks();
    (localTracks || []).forEach((track: any) => track.stop());
    this.remoteStream.map((stream: any) => {
      const remoteTracks = stream && stream.getTracks();
      (remoteTracks || []).forEach((track: any) => track.stop());
    });
    // const remoteTracks = this.remoteStream && this.remoteStream.getTracks();
    // (remoteTracks || []).forEach((track: any) => track.stop());
    this.peerConnection && this.peerConnection.close();
  
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
    document.location.replace('/');
  }

  createRoom = async () => {
    const roomRef = await doc(collection(this.firestore, "rooms"));
    this.peerConnection = new RTCPeerConnection(this.configuration);
    this.registerPeerConnectionListeners();
  
    this.localStream.getTracks().forEach((track: any) => {
      this.peerConnection.addTrack(track, this.localStream);
    });
  
    // Code for collecting ICE candidates below
    const callerCandidatesCollection = collection(roomRef, "callerCandidates");
  
    this.peerConnection.addEventListener('icecandidate', (event: any) => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      addDoc(callerCandidatesCollection, event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above
  
    // Code for creating a room below
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    console.log('Created offer:', offer);
  
    const roomWithOffer = {
      'offer': {
        type: offer.type,
        sdp: offer.sdp,
      },
    };
    await setDoc(roomRef, roomWithOffer)
    this.roomId = roomRef.id;
    this.meetingCode = roomRef.id;
    this.showMeetingInfo();
  
    this.peerConnection.addEventListener('track', (event: any) => {
      console.log('Got remote track:', event.streams[0]);
      console.log('Got remote track11:', event.streams);
      this.remoteStream = (event.streams || []).map((stream: any) => {
        const rmStream = new MediaStream();
        stream.getTracks().forEach((track: any) => {
          rmStream.addTrack(track);
        });
        return rmStream;
      });

      // event.streams[0].getTracks().forEach((track: any) => {
      //   this.remoteStream.addTrack(track);
      // });
    });
  
    // Listening for remote session description below
    onSnapshot(roomRef, async (snapshot: any) => {
      const data = snapshot.data();
      if (!this.peerConnection.currentRemoteDescription) {
        (data?.answer || []).map(async (answer: any) => {
          const rtcSessionDescription = new RTCSessionDescription(answer);
          await this.peerConnection.setRemoteDescription(rtcSessionDescription);
        });
      }
    });
    // Listening for remote session description above
  
    // Listen for remote ICE candidates below
    onSnapshot(collection(roomRef, 'calleeCandidates'), (snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    }));
    // Listen for remote ICE candidates above
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

  handleMeetingCodeChange(evt: any) {
    this.meetingId = evt.target.value;
  }

  handleCopy(text: any = '') {
    navigator.clipboard.writeText(text);
  }

  showMeetingInfo() {
    document.getElementById("meetingInfoBtn")?.click();
  }

  toggleLocalVideo() {
    const localVideoTrack = this.localStream.getTracks().find((track: any) => track.kind === 'video');
    localVideoTrack.enabled = !localVideoTrack.enabled;
    this.isLocalCamOn = localVideoTrack.enabled;
  }

  toggleLocalMic() {
    const localMicTrack = this.localStream.getTracks().find((track: any) => track.kind === 'audio');
    localMicTrack.enabled = !localMicTrack.enabled;
    this.isLocalMicOn = localMicTrack.enabled;
  }

  get getMeetingLink() {
    return `${location.origin}/confrence/${this.meetingCode}`
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.meetingCode = params.get('meetingCode') || '';
      this.openUserMedia(this.meetingCode);
    });
  }
}
