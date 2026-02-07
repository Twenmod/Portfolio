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
    p = fract(p * 0.3183099f + vec3(0.1f, 0.2f, 0.3f));
    p *= 17.0f;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0f - 2.0f * f);
    float n000 = hash(i + vec3(0.0f, 0.0f, 0.0f));
    float n100 = hash(i + vec3(1.0f, 0.0f, 0.0f));
    float n010 = hash(i + vec3(0.0f, 1.0f, 0.0f));
    float n110 = hash(i + vec3(1.0f, 1.0f, 0.0f));
    float n001 = hash(i + vec3(0.0f, 0.0f, 1.0f));
    float n101 = hash(i + vec3(1.0f, 0.0f, 1.0f));
    float n011 = hash(i + vec3(0.0f, 1.0f, 1.0f));
    float n111 = hash(i + vec3(1.0f, 1.0f, 1.0f));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
    float v = 0.0f;
    float a = 0.5f;
    for(int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.02f;
        a *= 0.5f;
    }
    return v;
}

vec2 rayBox(vec3 ro, vec3 rd, vec3 boxSize) {
    vec3 m = 1.0f / rd;
    vec3 n = m * ro;
    vec3 k = abs(m) * boxSize;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    float tN = max(max(t1.x, t1.y), t1.z);
    float tF = min(min(t2.x, t2.y), t2.z);
    return vec2(tN, tF);
}

float SampleDensity(vec3 p) {
    float profile = 1.f - smoothstep(0.f, 1.f, length(p - vec3(0.f)));
    float noise = 1.f;
    //fbm(p);
    return profile * 10.f * noise;
}

void main() {
    vec2 uv = (v_uv * 2.0f - 1.0f);
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;

    float yaw = u_camAngles.x;
    float pitch = u_camAngles.y;
    vec3 forward = normalize(vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)));
    vec3 right = normalize(vec3(sin(yaw - 1.5708f), 0.0f, cos(yaw - 1.5708f)));
    vec3 up = normalize(cross(right, forward));

    float fov = 1.1f;
    vec3 rd = normalize(forward + right * uv.x * fov + up * uv.y * fov);
    vec3 ro = u_camPos;

    vec3 boxSize = vec3(1.5f, 1.5f, 1.5f);
    vec2 tHit = rayBox(ro, rd, boxSize);
    if(tHit.x > tHit.y) {
        outColor = vec4(0.0f, 0.0f, 0.0f, 0.0f);
        return;
    }
    float t = tHit.x;
    float tEnd = tHit.y;
    const int steps = 32;
    float stepSize = (tEnd - t) / float(steps);
    vec3 lightDir = normalize(vec3(0.6f, 0.7f, -0.2f));
    vec3 light = vec3(0.f);
    float density = 0.f;
    float transmission = 1.f;
    for(int i = 0; i < steps; i++) {
        if(t > tEnd)
            break;
        vec3 p = ro + rd * t;

        float sampleDensity = SampleDensity(p);

//Light
        const vec3 lightDir = normalize(vec3(1.f, -1.f, 1.f));
        const float lightStepSize = 0.16f;
        const vec3 sun_light = vec3(1.f, 0.9f, 0.9f) * 2.f;
        float lightDensity = 0.f;
        for(int j = 0; j < 16; j++) {
            vec3 lightSample = p + lightDir * float(j) * lightStepSize;
            lightDensity += SampleDensity(lightSample);
        }
        float lightTransmission = exp(-lightDensity);
        light += lightTransmission * sun_light * sampleDensity * stepSize;

        density += sampleDensity * 0.1f;
        transmission = exp(-density);
        t += stepSize;
    }

    outColor = vec4(light, 1.f - transmission);
}
