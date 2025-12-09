// src/app/component/login/login.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  // Estas propiedades coinciden con tu template: username, contrasenia, errorMessage
  username: string = '';
  contrasenia: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  // método que tu template llama con (ngSubmit)="login()"
  login(): void {
    this.errorMessage = '';

    if (!this.username || !this.contrasenia) {
      this.errorMessage = 'Usuario y contraseña son requeridos';
      return;
    }

    this.loading = true;

    this.authService.login({ username: this.username, password: this.contrasenia }).subscribe({
      next: (res: any) => {
        this.loading = false;

        // token puede venir en la respuesta o ya fue guardado por el servicio
        const token = (res && (res.token || (res as any).token)) ?? localStorage.getItem('token');

        if (!token) {
          this.errorMessage = res?.message || 'No se recibió token del servidor';
          return;
        }

        // Redirigir al home u otra ruta
        this.router.navigate(['/home']);
      },
      error: (err: any) => {
        this.loading = false;
        console.error('Login error', err);
        if (err?.status === 401) {
          this.errorMessage = 'Credenciales inválidas';
        } else {
          this.errorMessage = 'Ocurrió un error. Intenta de nuevo.';
        }
      }
    });
  }
}
