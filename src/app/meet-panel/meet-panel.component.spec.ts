import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetPanelComponent } from './meet-panel.component';

describe('MeetPanelComponent', () => {
  let component: MeetPanelComponent;
  let fixture: ComponentFixture<MeetPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MeetPanelComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
