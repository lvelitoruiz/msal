import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import {
  MsalService,
  MsalBroadcastService,
  MSAL_GUARD_CONFIG,
  MsalGuardConfiguration,
} from '@azure/msal-angular';
import {
  AuthenticationResult,
  InteractionStatus,
  PopupRequest,
  RedirectRequest,
  EventMessage,
  EventType,
  PublicClientApplication,
} from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Angular 15 - MSAL Angular v3 Sample';
  isIframe = false;
  loginDisplay = false;
  private readonly _destroying$ = new Subject<void>();
  private pca: any;
  private isInitialized = false;

  constructor(
    @Inject(MSAL_GUARD_CONFIG) private msalGuardConfig: MsalGuardConfiguration,
    private authService: MsalService,
    private msalBroadcastService: MsalBroadcastService
  ) {
    this.initializeMsal();
  }

  private async initializeMsal() {
    console.log('Initializing MSAL');
    this.pca = await new PublicClientApplication({
      auth: {
        clientId: environment.msalConfig.auth.clientId,
        authority: environment.msalConfig.auth.authority,
        redirectUri: 'http://localhost:4200',
      },
    });
  }

  async ngOnInit() {
    if (this.isInitialized) {
      await this.pca.initialize();
      await this.pca.handleRedirectPromise().then((res: any) => {
        if (res != null && res.account != null) {
          this.pca.setActiveAccount(res.account);
        }
      });
    }

    await this.setLoginDisplay();

    await this.msalBroadcastService.msalSubject$
      .pipe(
        filter(
          (msg: EventMessage) =>
            msg.eventType === EventType.ACCOUNT_ADDED ||
            msg.eventType === EventType.ACCOUNT_REMOVED
        )
      )
      .subscribe((result: EventMessage) => {
        if (this.authService.instance.getAllAccounts().length === 0) {
          window.location.pathname = '/';
        } else {
          this.setLoginDisplay();
        }
      });

    this.msalBroadcastService.inProgress$
      .pipe(
        filter(
          (status: InteractionStatus) => status === InteractionStatus.None
        ),
        takeUntil(this._destroying$)
      )
      .subscribe(() => {
        this.setLoginDisplay();
        this.checkAndSetActiveAccount();
      });
  }

  async setLoginDisplay() {
    this.loginDisplay =
      (await this.authService.instance.getAllAccounts().length) > 0;
  }

  async checkAndSetActiveAccount() {
    /**
     * If no active account set but there are accounts signed in, sets first account to active account
     * To use active account set here, subscribe to inProgress$ first in your component
     * Note: Basic usage demonstrated. Your app may require more complicated account selection logic
     */
    let activeAccount = this.authService.instance.getActiveAccount();

    if (
      !activeAccount &&
      (await this.authService.instance.getAllAccounts().length) > 0
    ) {
      let accounts = this.authService.instance.getAllAccounts();
      await this.authService.instance.setActiveAccount(accounts[0]);
    }
  }

  async loginRedirect() {
    if (this.msalGuardConfig.authRequest) {
      await this.authService.loginRedirect({
        ...this.msalGuardConfig.authRequest,
      } as RedirectRequest);
    } else {
      await this.authService.loginRedirect();
    }
  }

  async loginPopup() {
    if (this.msalGuardConfig.authRequest) {
      await this.authService
        .loginPopup({ ...this.msalGuardConfig.authRequest } as PopupRequest)
        .subscribe((response: AuthenticationResult) => {
          this.authService.instance.setActiveAccount(response.account);
        });
    } else {
      await this.authService
        .loginPopup()
        .subscribe((response: AuthenticationResult) => {
          this.authService.instance.setActiveAccount(response.account);
        });
    }
  }

  logout(popup?: boolean) {
    if (popup) {
      this.authService.logoutPopup({
        mainWindowRedirectUri: '/',
      });
    } else {
      this.authService.logoutRedirect();
    }
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}
