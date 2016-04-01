(function () {

	var TwtrGlobe = this.TwtrGlobe = { },

	// Constants
	POS_X = 0,
	POS_Y = 800,
	POS_Z = 2000,
	FOV = 45,
	NEAR = 1,
	FAR = 150000,
	PI_HALF = Math.PI / 2;

	DISTANCE = 10000;
	IDLE = true;
	IDLE_TIME = 1000 * 3;   


	var renderer, camera, scene, pubnub, innerWidth, innerHeight;

	// Use the visibility API to avoid creating a ton of data when the user is not looking
	var VISIBLE = true;

	var DEBUG = false; // Show stats or not

	var target = {
	  x: -2,
	  y: 0,
	  zoom: 2500
	};

	/**
	 *	Initiates WebGL view with Three.js
	 */
	TwtrGlobe.init = function () {
		
		if (!this.supportsWebGL()) {
			window.location = '/upgrade';
			return;
		}

		var innerWidth = window.innerWidth;
		var innerHeight = window.innerHeight;

		// simple renderer
		renderer = new THREE.WebGLRenderer({ antialiasing: true });
		renderer.setSize(innerWidth, innerHeight);
		renderer.setClearColor(0x2a2a2b, 0.0);

		// adding to the target element
		document.getElementById('globe-holder').appendChild(renderer.domElement);

		// camera that points to the center
		camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, NEAR, FAR);
		camera.position.set(POS_X, POS_Y, POS_Z);
		camera.lookAt( new THREE.Vector3(0,0,0) );

		// creates a scene and adds camera
		scene = new THREE.Scene();
		scene.add(camera);

		// creating background space
		var urls = [
		  '/images/pos-x.png',
		  '/images/neg-x.png',
		  '/images/pos-y.png',
		  '/images/neg-y.png',
		  '/images/pos-z.png',
		  '/images/neg-z.png'
		];

		// creating background space
		var cubemap = THREE.ImageUtils.loadTextureCube(urls);
		cubemap.format = THREE.RGBFormat;

		var shader = THREE.ShaderLib["cube"];
		shader.uniforms["tCube"].value = cubemap;

		var material = new THREE.ShaderMaterial({
		  fragmentShader: shader.fragmentShader,
		  vertexShader: shader.vertexShader,
		  uniforms: shader.uniforms,
		  depthWrite: false,
		  side: THREE.BackSide
		});

		var skybox = new THREE.Mesh(new THREE.CubeGeometry(100000, 100000, 100000), material);
		scene.add(skybox);

		addEarth();
		// addStats();
		animate();

		window.addEventListener ('resize', onWindowResize);

		
	}

	var earthMesh, beaconHolder;
	/**
	 *	Creates the Earth sphere
	 */
	function addEarth () {
		// create earth
	  var sphereGeometry = new THREE.SphereGeometry(600, 50, 50);

	  var shader = Shaders.earth;
	  var uniforms = THREE.UniformsUtils.clone(shader.uniforms);

	  uniforms['texture'].value = THREE.ImageUtils.loadTexture('/images/earth-day.jpg');

	  var material = new THREE.ShaderMaterial({
	    uniforms: uniforms,
	    vertexShader: shader.vertexShader,
	    fragmentShader: shader.fragmentShader
	  });

	  earthMesh = new THREE.Mesh(sphereGeometry, material);
	  scene.add(earthMesh);

	  // add an empty container for the beacons to be added to
	  beaconHolder = new THREE.Object3D();
	  earthMesh.add(beaconHolder);

	  // Add atmosphere glow
	  var shader = Shaders['atmosphere'];
	  uniforms = THREE.UniformsUtils.clone(shader.uniforms);

	  material = new THREE.ShaderMaterial({
	    uniforms: uniforms,
	    vertexShader: shader.vertexShader,
	    fragmentShader: shader.fragmentShader,
	    side: THREE.BackSide,
	    blending: THREE.AdditiveBlending,
	    transparent: true
	  });

	  earthMesh = new THREE.Mesh(sphereGeometry, material);
	  earthMesh.scale.set(1.1, 1.1, 1.1);
	  scene.add(earthMesh);
	}

	// var stats;

	/**
	 * Adds FPS stats view for debugging
	 */
	// function addStats () {
	// 	stats = new Stats();
	// 	stats.setMode(0); // 0: fps, 1: ms

	// 	stats.domElement.style.position = 'absolute';
	// 	stats.domElement.style.right = '20px';
	// 	stats.domElement.style.bottom = '100px';

	// 	document.body.appendChild( stats.domElement );
	// }

	/**
	 * Converts a latlong to Vector3 for use in Three.js
	 */
	function latLonToVector3 (lat, lon, height) {

		height = height ? height : 0;

	  var vector3 = new THREE.Vector3(0, 0, 0);

	  lon = lon + 10;
	  lat = lat - 2;

	  var phi = PI_HALF - lat * Math.PI / 180 - Math.PI * 0.01;
	  var theta = 2 * Math.PI - lon * Math.PI / 180 + Math.PI * 0.06;
	  var rad = 600 + height;

	  vector3.x = Math.sin(phi) * Math.cos(theta) * rad;
	  vector3.y = Math.cos(phi) * rad;
	  vector3.z = Math.sin(phi) * Math.sin(theta) * rad;

	  return vector3;
	};

	/**
	 *	Adds a Tweet to the Earth, called from TweetHud.js
	 */
	TwtrGlobe.onTweet = function (tweet) {

		// extract a latlong from the Tweet object
		var latlong = {
			lat: tweet.coordinates.coordinates[1],
			lon: tweet.coordinates.coordinates[0]
		};
		
		var position = latLonToVector3(latlong.lat, latlong.lon);

		addBeacon(position, tweet);
	}

	/**
	 *	Adds a beacon (line) to the surface of the Earth
	 */
	function addBeacon (position, tweet) {
		
		var beacon = new TweetBeacon(tweet);

	  beacon.position.x = position.x;
	  beacon.position.y = position.y;
	  beacon.position.z = position.z;
	  beacon.lookAt(earthMesh.position);
		beaconHolder.add(beacon);

		// remove beacon from scene when it expires itself
		beacon.onHide(function () {
			beaconHolder.remove(beacon);
		});
	}

	/**
	 * Render loop
	 */
	// function animate () {
	//   requestAnimationFrame(animate);
 //    if (stats) stats.begin();
 //    render();
 //    if (stats) stats.end();
	// }

	var stats = new Stats();
	stats.setMode(0); // 0: fps, 1: ms

	// Align top-left
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.right = '0px';
	stats.domElement.style.top = '0px';

	if (DEBUG) {
	  document.body.appendChild( stats.domElement );
	}

	// render animation
	function animate() {
	  requestAnimationFrame(animate);
	  if (VISIBLE) {
	    if (DEBUG) stats.begin();
	    render();
	    if (DEBUG) stats.end();
	  }
	}

	// Move the globe automatically if idle
	function checkIdle() {
	  if (IDLE === true) {
	    target.x -= 0.001;

	    if (target.y > 0) target.y -= 0.001;
	    if (target.y < 0) target.y += 0.001;

	    if (Math.abs(target.y) < 0.01) target.y = 0;
	  }
	};

	/**
	 * Runs on each animation frame
	 */ 
	var rotation = { x: 0, y: 0 };

	function render () {

		// earthMesh.rotation.y = earthMesh.rotation.y + 0.005;

		rotation.x += (target.x - rotation.x) * 0.1;
		rotation.y += (target.y - rotation.y) * 0.1;
		DISTANCE += (target.zoom - DISTANCE) * 0.3;

		checkIdle();


	  // Convert our 2d camera target into 3d world coords
	  camera.position.x = DISTANCE * Math.sin(rotation.x) * Math.cos(rotation.y);
	  camera.position.y = DISTANCE * Math.sin(rotation.y);
	  camera.position.z = DISTANCE * Math.cos(rotation.x) * Math.cos(rotation.y);
	  camera.lookAt( scene.position );

		
	  renderer.autoClear = false;
	  renderer.clear();
	  renderer.render( scene, camera );
	}

	/**
	 * Updates camera and rendered when browser resized
	 */
	function onWindowResize (event) {
		innerWidth = window.innerWidth;
		innerHeight = window.innerHeight;

	  camera.aspect = innerWidth / innerHeight;
	  camera.updateProjectionMatrix();
	  renderer.setSize(innerWidth, innerHeight);
	}

	/**
	 * Detects WebGL support
	 */
	TwtrGlobe.supportsWebGL = function () {
		return ( function () { try { var canvas = document.createElement( 'canvas' ); return !! window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ); } catch( e ) { return false; } } )();
	}

	return TwtrGlobe;

})().init();