
EMPTY_RE = /^\s*$/;
COMMENT_RE = /^\s*;/;
TEXTURE_RE = /^\s*([A-Za-z0-9_-]+)\s*(-?[0-9]+)\s*(-?[0-9]+)/;
PATCH_RE = /^\s*\*\s*([A-Za-z0-9_-]+)\s*(-?[0-9]+)\s*(-?[0-9]+)/;

class PatchesStore {
	constructor(rootPath, extension) {
		this.patches = {};
		this.rootPath = rootPath;
		this.extension = extension;
		this.waitingLoad = 0;

		// Make a container for holding patch images
		this.container = document.createElement("div");
		this.container.style.display = "none";
		document.body.appendChild(this.container);
	}

	loadPatch(name) {
		name = name.toLowerCase();
		if (name in this.patches) {
			return;
		}
		var filename = this.rootPath + "/" + name + this.extension;
		var img = document.createElement("img");
		img.setAttribute("src", filename);
		this.waitingLoad++;
		var ps = this;
		img.onload = function() {
			console.log("Patch loaded: " + name);
			ps.patchLoaded();
		}
		this.container.append(img);
		this.patches[name] = img;
	}

	getPatch(name) {
		name = name.toLowerCase();
		if (name in this.patches) {
			return this.patches[name];
		}
		throw "Patch not in loaded set: " + name;
	}

	patchLoaded() {
		this.waitingLoad--;
		if (this.waitingLoad == 0 && this.onload != null) {
			this.onload();
		}
	}

	loadAllPatches(textures, callback) {
		var ps = this;
		ps.onload = function() {
			ps.onload = null;
			callback();
		}
		var i, j;
		for (i = 0; i < textures.length; ++i) {
			var tx = textures[i];
			for (j = 0; j < tx.patches.length; ++j) {
				this.loadPatch(tx.patches[j].name);
			}
		}
	}
}

class Patch {
	constructor(name, x, y) {
		this.name = name;
		this.x = x;
		this.y = y;
	}

	toString() {
		return "*    " + this.name + " " + this.x + " " + this.y;
	}
}

class Texture {
	constructor(name, width, height) {
		this.name = name;
		this.width = width;
		this.height = height;
		this.patches = [];
	}

	addPatch(p) {
		this.patches.push(p);
	}

	toString() {
		var hdr = this.name + " " + this.width + " " + this.height;
		return hdr + "\n" + this.patches.join("\n");
	}

	drawTexture(ps) {
		var canvas = document.createElement("canvas");
		canvas.setAttribute("width", this.width);
		canvas.setAttribute("height", this.height);
		var ctx = canvas.getContext("2d");
		var i;
		for (i = 0; i < this.patches.length; ++i) {
			var patch = this.patches[i];
			var img = ps.getPatch(patch.name);
			ctx.drawImage(img, patch.x, patch.y);
		}
		return canvas;
	}
}

function parseTextures(config) {
	var lines = config.split("\n");
	var i;
	var textures = [], tx = null;
	for (i = 0; i < lines.length; ++i) {
		var line = lines[i];
		console.log(line);
		if (COMMENT_RE.exec(line)) {
			continue;
		}
		var m = TEXTURE_RE.exec(line);
		if (m) {
			var w = parseInt(m[2]);
			var h = parseInt(m[3]);
			tx = new Texture(m[1], w, h);
			textures.push(tx);
			continue;
		}
		var m = PATCH_RE.exec(line);
		if (m) {
			var x = parseInt(m[2]);
			var y = parseInt(m[3]);
			tx.addPatch(new Patch(m[1], x, y));
			continue;
		}
		if (!EMPTY_RE.exec(line)) {
			throw "Parse error in texture file: " + line;
		}
	}
	return textures;
}

function loadTexturesFile(url, callback) {
	console.log("load textures from " + url);
	var url;
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url);
	xhr.onreadystatechange = function() {
		console.log("response loading " + xhr.responseURL + ": " +
		            xhr.status);
		if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
			var textures = parseTextures(xhr.responseText);
			console.log("loaded " + textures.length +
			            " textures from file: " + xhr.responseURL);
			callback(textures);
		}
	}
	xhr.send();
}

function loadAllTextures(urls, callback) {
	var waitingTextures = urls.length;
	var allTextures = [];
	var i;
	for (i = 0; i < urls.length; ++i) {
		loadTexturesFile(urls[i], function(textures) {
			allTextures = allTextures.concat(textures);
			--waitingTextures;
			if (waitingTextures == 0) {
				callback(allTextures);
			}
		});
	}
}

function renderAllTextures(element, game) {
	var ps = new PatchesStore(game + "/patches", ".png");
	urls = [game + "/textures/texture1.txt"];
	if (game != "doom2") {
		urls.push(game + "/textures/texture2.txt");
	}
	loadAllTextures(urls, function(textures) {
		ps.loadAllPatches(textures, function() {
			element.innerHTML = "";
			var i;
			for (i = 0; i < textures.length; ++i) {
				var tx = textures[i];
				var canvas = tx.drawTexture(ps);
				//element.appendChild(document.createTextNode(tx.name));
				element.appendChild(canvas);
				//element.appendChild(document.createElement("br"));
			}
		});
	});
}

function getGame() {
	var u = new URL(window.location.href);
	var game = u.searchParams.get("game");
	if (game == null) {
		return "doom1";
	}
	return game;
}

window.onload = function() {
	console.log("page loaded");
	var el = document.getElementById("texture-list");
	el.innerHTML = "Loading...";
	document.body.appendChild(el);
	var game = getGame();
	console.log("rendering for " + game);
	renderAllTextures(el, game);
}

