#version 300 es
precision highp float;
precision highp sampler3D;

out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_camPos;
uniform vec2 u_camAngles;
uniform sampler3D u_profileTex;
uniform sampler3D u_noiseTex;
uniform vec3 u_boxSize;

float Remap(float value, float low1, float high1, float low2, float high2) {
    return low2 + (value - low1) * (high2 - low2) / (high1 - low1);
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

float SampleProfile(vec3 p) {
    vec3 puvw = p / (normalize(vec3(145, 132, 41)) * 2.2f) * 0.5f + 0.5f;
    puvw.y = 1.f - puvw.y;
    if(any(lessThan(puvw, vec3(0.f))) || any(greaterThan(puvw, vec3(1.f)))) {
        return 0.f;
    }
    float profile = texture(u_profileTex, puvw).r;
    profile = min(max(profile, 0.f), 1.f);
    return profile;
}

float SampleDensity(vec3 p, float profile) {
    //float profile = 1.f - smoothstep(0.f, 1.f, length(p));
    //profile *= 5.f;

    vec3 uvw = p / u_boxSize * 0.5f + 0.5f;
    uvw.y = 1.f - uvw.y;
    float noise = texture(u_noiseTex, uvw * 2.0f + u_time * 0.01f).r;
    return min(max((Remap(profile, noise, 1.f, 0.f, 1.f)), 0.f), 1.f) * 4.5f;
}

float InScatteringApprox(float _baseDimensionalProfile, float _sun_dot, float _sunDensitySamples) {
    return exp(-_sunDensitySamples * Remap(_sun_dot, 0.0f, 0.9f, 0.25f, Remap(_baseDimensionalProfile, 1.0f, 0.0f, 0.05f, 0.25f)));
}

void main() {
    vec2 uv = (v_uv * 2.0f - 1.0f);
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;

    float yaw = u_camAngles.x;
    float pitch = u_camAngles.y;
    vec3 forward = -normalize(vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)));
    vec3 right = normalize(vec3(sin(yaw - 1.5708f), 0.0f, cos(yaw - 1.5708f)));
    vec3 up = normalize(cross(right, forward));

    float fov = 0.4f;
    vec3 rd = normalize(forward + right * uv.x * fov + up * uv.y * fov);
    vec3 ro = u_camPos;

    vec3 boxSize = u_boxSize;
    vec2 tHit = rayBox(ro, rd, boxSize);

    if(tHit.x > tHit.y) {
        outColor = vec4(0.0f);
        return;
    }

    if(tHit.y < 0.0f) {
        outColor = vec4(0.0f);
        return;
    }

    float t = max(tHit.x, 0.0f);
    float tEnd = tHit.y;

    const int steps = 64;
    float stepSize = (tEnd - t) / float(steps);
    vec3 lightDir = normalize(vec3(0.6f, 0.7f, 0.2f));
    vec3 light = vec3(0.f);
    float transmittance = 1.0f;
    const float lightStepSize = 0.16f;
    const vec3 sun_light = vec3(1.f, 0.9f, 0.9f) * 1.f;
    float sun_dot = dot(lightDir, rd);
    for(int i = 0; i < steps; i++) {
        if(t > tEnd)
            break;

        vec3 p = ro + rd * t;
        float profile = SampleProfile(p);
        float sampleDensity = SampleDensity(p, profile);

        float lightDensity = 0.0f;

        for(int j = 0; j < 16; j++) {
            vec3 lightSample = p - lightDir * float(j) * lightStepSize;
            float lprofile = SampleProfile(lightSample);

            lightDensity += SampleDensity(lightSample, lprofile) * lightStepSize;
        }

        float lightVolume = InScatteringApprox(1.f - profile, sun_dot, lightDensity);
        vec3 scatter = sun_light * lightVolume;
        float ambientDens = 0.f;
        for(int j = 0; j < 16; j++) {
            vec3 lightSample = p - vec3(0.f, 1.f, 0.f) * float(j) * lightStepSize;
            float lprofile = SampleProfile(lightSample);

            ambientDens += SampleDensity(lightSample, lprofile) * lightStepSize;
        }

        vec3 ambient = min(max(pow(profile, 0.5f), 0.f), 1.f) * exp(-ambientDens) * vec3(0.98f, 0.8f, 0.9f) * 0.2f;

        light += transmittance * (scatter + ambient) * sampleDensity * stepSize;

        transmittance *= exp(-sampleDensity * stepSize);

        t += stepSize;
    }

    outColor = vec4(light, 1.f - transmittance);
}
