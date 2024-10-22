/** Core Class */
class PlainGallery extends EventTarget {

    static Event = {
        OPEN: 'open',
        CHANGE: 'change',
        CLOSE: 'close',
    }

    current = null;
    dataSource = [];
    shadeMask = new ShadeMask(this);
    toolbar = new Toolbar(this);

    constructor(gallery, children) {
        super();
        window.addEventListener('resize', this.#adaptViewport.bind(this));
        this.#bindSlideEvents();

        // Traverse all thumbnail items
        let ordinal = 0;
        for (const group of document.querySelectorAll(gallery)) {
            const thumbnails = [];
            this.dataSource.push(thumbnails);

            let index = 0;
            for (const item of group.querySelectorAll(children)) {
                const thumbnail = item.querySelector('img');
                if (!thumbnail) continue;

                thumbnails.push(thumbnail);
                thumbnail.originalUrl = item.getAttribute('href');
                thumbnail.ordinal = ordinal;
                thumbnail.index = index++;
                thumbnail.addEventListener('click', e => {
                    e.preventDefault();
                    this.#openViewport(e.target);
                });
            }
            ordinal++;
        }
    }

    #openViewport(source) {
        this.current = this.#cloneImage(source);
        this.#changeSlideArrows();
        this.#bindZoomEvents();
        this.shadeMask.fadeIn();
        this.#adaptViewport(true);

        this.fire(PlainGallery.Event.OPEN, this.current);
        this.fire(PlainGallery.Event.CHANGE, this.current);
    }

    #adaptViewport(delay) {
        if (!this.shadeMask.isOpened) return;
        const scrRatio = innerWidth / innerHeight;
        const img = this.current;

        img.scale = img.aspectRatio > scrRatio ? innerWidth / img.width : innerHeight / img.height;
        img.initScale = img.scale;
        img.minScale = img.scale / 2;
        img.maxScale = img.scale * 10;
        img.initX = img.transX = innerWidth / 2 - img.centerPoint.x;
        img.initY = img.transY = innerHeight / 2 - img.centerPoint.y;

        const adapt = () => { img.translating(); img.scaling(); }
        delay ? setTimeout(adapt) : adapt();
    }

    #bindSlideEvents() {
        const { prevBtn, nextBtn } = this.shadeMask;
        prevBtn.onclick = nextBtn.onclick = (e) => {
            e.stopPropagation();

            // Slide the current image out
            // Stop sliding if thumbnail is null (first or last image)
            const { direction } = e.currentTarget;
            const { ordinal, index } = this.current;
            const thumbnail = this.#getThumbnail(ordinal, index + direction);
            if (!thumbnail) return;
            this.#slideImage(direction, true);

            // Slide the next image in
            this.current = this.#cloneImage(thumbnail);
            this.#adaptViewport(false);
            this.#slideImage(-direction, false); // Hide from the screen
            this.#changeSlideArrows();
            this.#bindZoomEvents();
            this.shadeMask.updateImage();

            setTimeout(() => {
                this.#slideImage(direction, false);
                this.fire(PlainGallery.Event.CHANGE, this.current);
            });
        }
    }

    #bindZoomEvents() {
        const gallery = this;
        const img = this.current;

        // Drag to preview
        img.onpointerdown = function (e) {
            e.preventDefault();
            this.moved = false;
            this.style.transition = 'unset';
            this.style.cursor = 'grab';
            this.startX = e.clientX;
            this.startY = e.clientY;

            this.onpointermove = function (e) {
                this.moved = true;
                this.style.cursor = 'grabbing';
                this.offsetX = e.clientX - this.startX;
                this.offsetY = e.clientY - this.startY;
                this.translating(this.transX + this.offsetX, this.transY + this.offsetY);
            }

            this.onpointerup = this.onpointerout = function (e) {
                this.transX += this.offsetX ?? 0;
                this.transY += this.offsetY ?? 0;
                this.onpointermove = null;
                this.style.transition = 'all .3s';

                // Click to zoom in/out
                if (e.type == 'pointerup' && !this.moved) {
                    this.transX = innerWidth - img.centerPoint.x - e.clientX;
                    this.transY = innerHeight - img.centerPoint.y - e.clientY;
                    this.scale = this.scale <= this.initScale ? this.scale *= 2 : this.initScale;
                    this.translating();
                    this.scaling(this.scale);
                }

                gallery.#switchZoomCursor();
                gallery.#checkImageBoundary();
            }
        };

        // Scroll to zoom
        img.onwheel = function (e) {
            e.preventDefault();
            this.scale = e.wheelDelta > 0 ? this.scale * 1.2 : this.scale / 1.2;
            if (this.scale > this.maxScale) this.scale = this.maxScale;
            if (this.scale < this.minScale) this.scale = this.minScale;
            this.scaling();

            gallery.#switchZoomCursor();
            gallery.#checkImageBoundary();
        }
    }

    #getThumbnail(ordinal, index) {
        const thumbnails = this.dataSource[ordinal];
        const max = thumbnails.length - 1;
        return index < 0 || index > max ? null : thumbnails[index];
    }

    #slideImage(direction, removeEl) {
        const img = this.current;
        direction > 0 ? img.transX -= innerWidth : img.transX += innerWidth;
        img.scale = img.initScale;
        img.translating();
        img.scaling();

        if (removeEl) {
            img.ontransitionend = () => img.remove();
        }
    }

    #changeSlideArrows() {
        const { ordinal, index } = this.current;
        const max = this.dataSource[ordinal].length - 1;
        const { prevBtn, nextBtn } = this.shadeMask;
        prevBtn.style.visibility = index == 0 ? 'hidden' : 'visible';
        nextBtn.style.visibility = index == max ? 'hidden' : 'visible';
    }

    #switchZoomCursor() {
        const img = this.current;
        img.style.cursor = img.scale <= img.initScale ? 'zoom-in' : 'zoom-out';
    }

    #checkImageBoundary() {
        const img = this.current;
        const width = img.width * img.scale;
        const height = img.height * img.scale;
        const bound = {
            x1: img.initX, x2: img.initX,
            y1: img.initY, y2: img.initY
        }
        if (width > innerWidth) {
            bound.x1 = width / 2 - img.centerPoint.x;
            bound.x2 = bound.x1 - (width - innerWidth);
        }
        if (height > innerHeight) {
            bound.y1 = height / 2 - img.centerPoint.y;
            bound.y2 = bound.y1 - (height - innerHeight);
        }
        if (img.transX > bound.x1) {
            img.transX = bound.x1;
            img.translating();
        }
        if (img.transX < bound.x2) {
            img.transX = bound.x2;
            img.translating();
        }
        if (img.transY > bound.y1) {
            img.transY = bound.y1;
            img.translating();
        }
        if (img.transY < bound.y2) {
            img.transY = bound.y2;
            img.translating();
        }
    }

    #cloneImage(source) {
        const { ordinal, index } = source;
        const rect = source.getBoundingClientRect();
        const clone = source.cloneNode(true);
        clone.originalUrl = source.originalUrl;
        clone.ordinal = ordinal;
        clone.index = index;

        clone.className = 'plga-slide-item';
        clone.style.left = rect.left;
        clone.style.top = rect.top;

        clone.aspectRatio = rect.width / rect.height;
        clone.centerPoint = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        }

        clone.translating = (x, y) => {
            clone.style.setProperty('--transX', (x ?? clone.transX) + 'px');
            clone.style.setProperty('--transY', (y ?? clone.transY) + 'px');
        }
        clone.scaling = (scale) => {
            clone.style.setProperty('--scale', scale ?? clone.scale);
        }
        clone.restore = () => {
            clone.translating(0, 0);
            clone.scaling(1);
            clone.ontransitionend = () => clone.remove();
        }
        return clone;
    }

    open(ordinal, index) {
        const source = this.#getThumbnail(ordinal ?? 0, index ?? 0);
        this.#openViewport(source);
    }

    close() {
        this.shadeMask.fadeOut();
        this.fire(PlainGallery.Event.CLOSE, this.current);
    }

    on(type, callback) {
        this.addEventListener(type, e => callback(e.detail));
    }

    fire(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }

}

/** Toolbar Component */
class Toolbar {

    gallery = null;
    el = createElement(`<div class="plga-toolbar">
        <div class="plga-toolbar-left"></div>
        <div class="plga-toolbar-right"></div>
    </div>`);

    constructor(gallery) {
        this.gallery = gallery;
        gallery.shadeMask.el.append(this.el);

        // Register default widget: counter
        this.register({
            html: '<div class="plga-counter"></div>',
            onInit: (el) => {
                gallery.on(PlainGallery.Event.CHANGE, (current) => {
                    const { ordinal, index } = gallery.current;
                    const total = gallery.dataSource[ordinal].length;
                    el.innerHTML = (index+1) + '/' + total;
                });
            }
        });
        // Register default widget: close button
        this.register({
            position: 'right',
            html: '<svg xmlns="http://www.w3.org/2000/svg" class="plga-icon" viewBox="0 0 32 32" width="32"><path d="M24 10l-2-2-6 6-6-6-2 2 6 6-6 6 2 2 6-6 6 6 2-2-6-6z"/></svg>',
            onInit: (el) => {
                el.onclick = () => gallery.close();
            }
        });
    }

    register(options) {
        const { position, html, onInit } = options;
        const widget = createElement(html);

        if (position == 'right') {
            const right = this.el.querySelector('.plga-toolbar-right');
            right.insertBefore(widget, right.firstChild);
        } else {
            const left = this.el.querySelector('.plga-toolbar-left');
            left.append(widget);
        }
        options.onInit(widget, this.gallery);
    }

}

/** Shade Mask Component */
class ShadeMask {

    gallery = null;
    isOpened = false;
    el = createElement(`<div class="plga-shade-mask">
        <svg class="plga-icon plga-icon-prev" viewBox="0 0 60 60" width="48"><path d="M29 43l-3 3-16-16 16-16 3 3-13 13 13 13z"/></svg>
        <svg class="plga-icon plga-icon-next" viewBox="0 0 60 60" width="48" transform="rotate(180)"><path d="M29 43l-3 3-16-16 16-16 3 3-13 13 13 13z"/></svg>
    </div>`);

    constructor(gallery) {
        this.gallery = gallery;
        this.embedStyles();

        this.prevBtn = this.el.querySelector('.plga-icon-prev');
        this.nextBtn = this.el.querySelector('.plga-icon-next');
        this.prevBtn.direction = -1;
        this.nextBtn.direction = 1;

        this.el.addEventListener('click', this.fadeOut.bind(this));
        window.addEventListener('keyup', this.fadeOut.bind(this));
        document.body.append(this.el);
    }

    fadeIn() {
        this.updateImage();
        this.el.ontransitionend = null;
        this.el.style.display = 'flex';
        setTimeout(() => this.el.style.background = 'rgba(0, 0, 0, .8)');
        this.isOpened = true;
    }

    fadeOut(e) {
        const { current, toolbar } = this.gallery;
        if (e && e.keyCode && e.keyCode !== 27) return;
        if (e && (e.target == current || toolbar.el.contains(e.target))) return;
        this.el.style.background = 'rgba(0, 0, 0, 0)';
        this.el.ontransitionend = () => this.el.style.display = 'none';
        this.gallery.current.restore();
        this.isOpened = false;
    }

    updateImage() {
        this.el.append(this.gallery.current);
    }

    embedStyles() {
        document.head.append(createElement(`<style>
            .plga-shade-mask {
                user-select: none;
                display: none;
                justify-content: space-between;
                align-items: center;
                position: fixed;
                z-index: 998;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0);
                color: #fff;
                transition: all .3s;
            }
            .plga-icon {
                z-index: 999;
                fill: currentcolor;
                cursor: pointer;
                opacity: .8;
                transition: all .3s;
                stroke: rgba(0,0,0,.3);
                stroke-width: .2;
            }
            .plga-icon:hover {
                opacity: 1;
            }
            .plga-icon-prev, .plga-icon-next {
                padding: 20px;
            }
            .plga-toolbar {
                position: absolute;
                z-index: 999;
                top: 0; left: 0; right:0;
                height: 60px;
                padding: 0 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                text-shadow: 1px 1px 5px rgba(0,0,0,.3);
            }
            .plga-toolbar>div {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .plga-slide-item {
                position: absolute;
                cursor: zoom-in;
                transform: translate(var(--transX), var(--transY)) scale(var(--scale));
                transition: all .3s;
            }
        </style>`.replace(/\s+/g, ' ')));
    }

}

function createElement(content) {
    if (!content) return;
    content = content.replace(/[\t\r\n]/mg, '').trim();

    if (content.indexOf('<') === 0) {
        const template = document.createElement('template');
        template.innerHTML = content;
        return template.content.firstElementChild.cloneNode(true);
    }
    return document.createElement(content);
}