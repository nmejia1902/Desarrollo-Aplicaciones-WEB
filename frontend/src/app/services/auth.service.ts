// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface LoginResponse {
  status?: number;
  message?: string;
  token?: string;
  user?: any;
  usuario?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';

  constructor(private http: HttpClient) {}

  // aceptar un objeto { username, password } para que sea compatible con el componente
  login(credentials: { username: string; password: string }): Observable<LoginResponse> {
    const body = {
      correo: credentials.username,
      password: credentials.password
    };

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, body).pipe(
      tap((res) => {
        // guardamos token y usuario SOLO si vienen
        const token = (res && (res as any).token) ?? (res && (res as any).token);
        const usuario = (res && ((res as any).user || (res as any).usuario)) ?? null;

        if (typeof token === 'string' && token.length > 0) {
          localStorage.setItem('token', token);
        }

        if (usuario) {
          try {
            localStorage.setItem('usuario', JSON.stringify(usuario));
          } catch {
            // ignore
          }
        }
      })
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }
}
