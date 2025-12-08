import { Injectable } from '@angular/core'; 
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  constructor(private http: HttpClient) {}
  login(userData: { username: string; password: string }): Observable<any> {
 
    const body = {
      correo: userData.username,
      password: userData.password
    };

    return this.http.post(`${this.apiUrl}/login`, body);
  }
}
