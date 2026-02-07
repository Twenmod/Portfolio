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

    function init(fragmentSource) {

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

        var start = performance.now();
        var last = start;
        var mouse = { x: 0, y: 0, down: false };
        var camera = { yaw: 0.6, pitch: 0.18, radius: 3.6 };
        var drag = { x: 0, y: 0 };

        function resize() {
            var rect = canvas.getBoundingClientRect();
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var width = Math.max(1, Math.floor(rect.width * dpr));
            var height = Math.max(1, Math.floor(rect.height * dpr));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
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
            camera.pitch = Math.max(-0.6, Math.min(0.6, camera.pitch + dy * 0.004));
        });

        canvas.addEventListener('wheel', function (event) {
            camera.radius = Math.max(2.4, Math.min(6.0, camera.radius + event.deltaY * 0.002));
        }, { passive: true });

        var observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();

        function render(now) {
            var elapsed = (now - start) * 0.001;
            var delta = (now - last) * 0.001;
            last = now;

            var camPos = [
                Math.sin(camera.yaw) * Math.cos(camera.pitch) * camera.radius,
                Math.sin(camera.pitch) * camera.radius,
                Math.cos(camera.yaw) * Math.cos(camera.pitch) * camera.radius
            ];

            gl.useProgram(program);
            gl.bindVertexArray(vao);
            gl.uniform2f(uResolution, canvas.width, canvas.height);
            gl.uniform1f(uTime, elapsed);
            gl.uniform2f(uMouse, mouse.x, mouse.y);
            gl.uniform3f(uCamPos, camPos[0], camPos[1], camPos[2]);
            gl.uniform2f(uCamAngles, camera.yaw, camera.pitch);

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

    fetch(fragmentUrl, { cache: 'no-store' })
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to load fragment shader');
            return res.text();
        })
        .then(function (source) {
            init(source);
        })
        .catch(function (err) {
            if (window.console) console.warn('Cloud shader load failed:', err);
        });
})();
