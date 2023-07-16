import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router'; 
import { SFUClient } from './sfu-client';
@Component({
  selector: 'app-meet-panel',
  templateUrl: './meet-panel.component.html',
  styleUrls: ['./meet-panel.component.scss']
})
export class MeetPanelComponent implements OnInit {
  meetingCode: any;
  username: any;
  sfuClient: any;
  isLocalCamOn: any = true;
  isLocalMicOn: any = true;
  streams: any = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {
  }

  handleCopy(text: any = '') {
    navigator.clipboard.writeText(text);
  }

  showMeetingInfo() {
    document.getElementById("meetingInfoBtn")?.click();
  }

  toggleLocalVideo() {
    this.isLocalCamOn = this.sfuClient.toggleLocalVideo();
  }

  toggleLocalMic() {
    this.isLocalMicOn = this.sfuClient.toggleLocalMic();
  }

  leave() {
    
  }

  get getMeetingLink() {
    return `${location.origin}/confrence/${this.meetingCode}`
  }

  subscribeSFUEvents(sfuClient: any) {
    sfuClient.on('onConnected', () => {
      this.route.paramMap.subscribe(params => {
        this.meetingCode = params.get('meetingCode') || '';
        this.meetingCode
        ? this.sfuClient.joinMeeting(this.meetingCode)
        : this.sfuClient.connect();
      });
    });

    sfuClient.on('onMeetingCreated', (meetingCode: any) => {
      this.meetingCode = meetingCode;
    });

    // sfuClient.on('onRemoteTrack', ({ stream, username }: any) => {
    //   console.log(stream, 'stream')
    //   this.streams.push(stream);
    // });
  }



  ngOnInit(): void {
    this.username = prompt("Please enter username");
    this.sfuClient = new SFUClient({ username: this.username});
    this.subscribeSFUEvents(this.sfuClient);
  }
}
