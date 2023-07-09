import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MeetPanelComponent } from './meet-panel/meet-panel.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'confrence', component: MeetPanelComponent },
  { path: 'confrence/:meetingCode', component: MeetPanelComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
