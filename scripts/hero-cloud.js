(function () {
    var canvas = document.getElementById('hero-cloud');
    if (!canvas) return;

    var gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true });
    if (!gl) return;

    var vertexSource = "#version 300 es\n" +
        "layout(location = 0) in vec2 a_pos;\n" +
        "out vec2 v_uv;\n" +
        "void main() {\n" +
        "  v_uv = a_pos * 0.5 + 0.5;\n" +
        "  gl_Position = vec4(a_pos, 0.0, 1.0);\n" +
        "}\n";

    var fragmentUrl = "/scripts/hero-cloud.frag.glsl";
    var fixedResolution = { longSide: 360 };
    var textureConfig = {
        profile: { url: "/media/textures/profile.raw", width: 145, height: 132, depth: 41 },
        noise: { url: "/media/textures/noise.raw", width: 128, height: 128, depth: 128 }
    };

    function init(fragmentSource, textures) {

        function compileShader(type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                if (window.console) console.error(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        var vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
        var fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        if (!vertexShader || !fragmentShader) return;

        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            if (window.console) console.error(gl.getProgramInfoLog(program));
            return;
        }

        var quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1
        ]), gl.STATIC_DRAW);

        var vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        var uResolution = gl.getUniformLocation(program, 'u_resolution');
        var uTime = gl.getUniformLocation(program, 'u_time');
        var uMouse = gl.getUniformLocation(program, 'u_mouse');
        var uCamPos = gl.getUniformLocation(program, 'u_camPos');
        var uCamAngles = gl.getUniformLocation(program, 'u_camAngles');
        var uProfileTex = gl.getUniformLocation(program, 'u_profileTex');
        var uNoiseTex = gl.getUniformLocation(program, 'u_noiseTex');
        var uBoxSize = gl.getUniformLocation(program, 'u_boxSize');

        var start = performance.now();
        var last = start;
        var mouse = { x: 0, y: 0, down: false };
        var camera = { yaw: 3.14, pitch: 0.18, radius: 4.2 };
        var idleSpinDelay = 2.0;
        var idleSpinSpeed = 0.25;
        var lastCameraInput = -idleSpinDelay * 1000;
        var idleCenterYaw = camera.yaw;
        var idleSpinRange = 0.85;
        var targetYaw = camera.yaw;
        var idleSpinDir = 1;
        var boxSize = { x: 1.5, y: 1.5, z: 1.5 };
        var drag = { x: 0, y: 0 };

        function resize() {
            var rect = canvas.getBoundingClientRect();
            var aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1;
            var targetWidth = fixedResolution.longSide;
            var targetHeight = fixedResolution.longSide;
            if (aspect >= 1) {
                targetHeight = Math.max(1, Math.round(fixedResolution.longSide / aspect));
            } else {
                targetWidth = Math.max(1, Math.round(fixedResolution.longSide * aspect));
            }
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        function updateMouseFromEvent(event) {
            var rect = canvas.getBoundingClientRect();
            mouse.x = (event.clientX - rect.left) / rect.width;
            mouse.y = 1 - (event.clientY - rect.top) / rect.height;
        }

        canvas.addEventListener('pointerdown', function (event) {
            mouse.down = true;
            drag.x = event.clientX;
            drag.y = event.clientY;
            lastCameraInput = performance.now();
            canvas.setPointerCapture(event.pointerId);
        });

        canvas.addEventListener('pointerup', function (event) {
            mouse.down = false;
            canvas.releasePointerCapture(event.pointerId);
        });

        canvas.addEventListener('pointerleave', function () {
            mouse.down = false;
        });

        canvas.addEventListener('pointermove', function (event) {
            updateMouseFromEvent(event);
            if (!mouse.down) return;
            var dx = event.clientX - drag.x;
            var dy = event.clientY - drag.y;
            drag.x = event.clientX;
            drag.y = event.clientY;
            camera.yaw += dx * 0.004;
            camera.pitch = Math.max(-0.6, Math.min(0.6, camera.pitch - dy * 0.004));
            lastCameraInput = performance.now();
        });

        canvas.addEventListener('wheel', function (event) {
            camera.radius = Math.max(1.4, Math.min(6.0, camera.radius + event.deltaY * 0.002));
            lastCameraInput = performance.now();
        }, { passive: true });

        var observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();

        function render(now) {
            var elapsed = (now - start) * 0.001;
            var delta = (now - last) * 0.001;
            last = now;

            if (!mouse.down && (now - lastCameraInput) * 0.001 > idleSpinDelay) {
                var speed = idleSpinSpeed;
                var diff = targetYaw - camera.yaw;
                if (diff < 0) diff = -diff;
                if (diff <= 0.5) {
                    targetYaw += speed * delta * idleSpinDir;
                    if (targetYaw > idleCenterYaw + idleSpinRange) {
                        targetYaw = idleCenterYaw + idleSpinRange;
                        idleSpinDir = -1;
                    } else if (targetYaw < idleCenterYaw - idleSpinRange) {
                        targetYaw = idleCenterYaw - idleSpinRange;
                        idleSpinDir = 1;
                    }
                }
                var alpha = delta * 2;
                camera.yaw = camera.yaw * (1 - alpha) + targetYaw * alpha;

                camera.pitch = camera.pitch * (1 - alpha) + 0.18 * alpha;

            }

            var camPos = [
                Math.sin(camera.yaw) * Math.cos(camera.pitch) * camera.radius,
                Math.sin(camera.pitch) * camera.radius,
                Math.cos(camera.yaw) * Math.cos(camera.pitch) * camera.radius
            ];

            gl.useProgram(program);
            gl.bindVertexArray(vao);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, textures.profile);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, textures.noise);
            gl.uniform2f(uResolution, canvas.width, canvas.height);
            gl.uniform1f(uTime, elapsed);
            gl.uniform2f(uMouse, mouse.x, mouse.y);
            gl.uniform3f(uCamPos, camPos[0], camPos[1], camPos[2]);
            gl.uniform2f(uCamAngles, camera.yaw, camera.pitch);
            gl.uniform1i(uProfileTex, 0);
            gl.uniform1i(uNoiseTex, 1);
            gl.uniform3f(uBoxSize, boxSize.x, boxSize.y, boxSize.z);

            gl.disable(gl.DEPTH_TEST);
            gl.clearColor(0.02, 0.03, 0.06, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            if (delta < 0.2) {
                requestAnimationFrame(render);
            } else {
                requestAnimationFrame(render);
            }
        }

        requestAnimationFrame(render);
    }

    function loadRaw3DTexture(config) {
        return fetch(config.url, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load 3D texture: ' + config.url);
                return res.arrayBuffer();
            })
            .then(function (buffer) {
                var expectedBytes = config.width * config.height * config.depth * 4;
                var data = new Float32Array(buffer);
                if (buffer.byteLength !== expectedBytes && window.console) {
                    console.warn('3D texture size mismatch:', config.url, buffer.byteLength, expectedBytes);
                }
                var texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_3D, texture);
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
                gl.texImage3D(
                    gl.TEXTURE_3D,
                    0,
                    gl.R32F,
                    config.width,
                    config.height,
                    config.depth,
                    0,
                    gl.RED,
                    gl.FLOAT,
                    data
                );
                gl.bindTexture(gl.TEXTURE_3D, null);
                return texture;
            });
    }

    Promise.all([
        fetch(fragmentUrl, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('Failed to load fragment shader');
            return res.text();
        }),
        loadRaw3DTexture(textureConfig.profile),
        loadRaw3DTexture(textureConfig.noise)
    ])
        .then(function (results) {
            init(results[0], { profile: results[1], noise: results[2] });
        })
        .catch(function (err) {
            if (window.console) console.warn('Cloud resources failed:', err);
        });
})();
