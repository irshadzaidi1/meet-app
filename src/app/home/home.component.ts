import { Component, OnInit, } from '@angular/core';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  meetingCode: string = '';

  constructor() {}
  
  get validMeetingCode() {
    return (this.meetingCode || '').length < 5;
  }

  ngOnInit(): void {}

}
