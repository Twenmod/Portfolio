#version 300 es
precision highp float;

out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_camPos;
uniform vec2 u_camAngles;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.02;
    a *= 0.5;
  }
  return v;
}

vec2 rayBox(vec3 ro, vec3 rd, vec3 boxSize) {
  vec3 m = 1.0 / rd;
  vec3 n = m * ro;
  vec3 k = abs(m) * boxSize;
  vec3 t1 = -n - k;
  vec3 t2 = -n + k;
  float tN = max(max(t1.x, t1.y), t1.z);
  float tF = min(min(t2.x, t2.y), t2.z);
  return vec2(tN, tF);
}

void main() {
  vec2 uv = (v_uv * 2.0 - 1.0);
  float aspect = u_resolution.x / u_resolution.y;
  uv.x *= aspect;

  float yaw = u_camAngles.x;
  float pitch = u_camAngles.y;
  vec3 forward = normalize(vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)));
  vec3 right = normalize(vec3(sin(yaw - 1.5708), 0.0, cos(yaw - 1.5708)));
  vec3 up = normalize(cross(right, forward));

  float fov = 1.1;
  vec3 rd = normalize(forward + right * uv.x * fov + up * uv.y * fov);
  vec3 ro = u_camPos;

  vec3 boxSize = vec3(2.5, 1.4, 2.5);
  vec2 tHit = rayBox(ro, rd, boxSize);
  if (tHit.x > tHit.y) {
    outColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  float t = max(tHit.x, 0.0);
  float tEnd = tHit.y;
  float stepSize = 0.08;
  vec3 lightDir = normalize(vec3(0.6, 0.7, -0.2));
  vec3 col = vec3(0.02, 0.04, 0.08);
  float trans = 1.0;

  for (int i = 0; i < 80; i++) {
    if (t > tEnd || trans < 0.02) break;
    vec3 p = ro + rd * t;
    float height = smoothstep(-1.2, 0.6, p.y);
    float d = fbm(p * 0.7 + vec3(0.0, u_time * 0.05, u_time * 0.03));
    float density = smoothstep(0.45, 0.8, d) * height;

    float lightSample = fbm(p + lightDir * 0.25 + vec3(0.0, u_time * 0.03, 0.0));
    float light = mix(0.4, 1.2, smoothstep(0.4, 0.9, lightSample));
    vec3 cloudCol = vec3(0.75, 0.85, 0.95) * light;

    float alpha = density * 0.08;
    col += cloudCol * alpha * trans;
    trans *= (1.0 - alpha);
    t += stepSize;
  }

  col = mix(col, vec3(0.02, 0.06, 0.12), 1.0 - trans);
  outColor = vec4(col, 1.0);
}
