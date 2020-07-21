var SwReg = null;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.min.js')
      .then((reg) => {
        SwReg = reg;
        if (SwReg.waiting) {
          notifyUpdate();
          setTimeout(function () {
            document.getElementById('update-notification').classList.add('show');
          }, 1000);
        }
      });
  });
}
function notifyUpdate() {
  var updateTitle = 'Update';
  var updateContent = 'New update available. Update now for new feature and better performance.';
  var container = document.createElement('div');
  container.setAttribute("class", "update-notification");
  container.setAttribute("id", "update-notification");

  var content = document.createElement('div');
  content.setAttribute("class", "content");
  var t = document.createElement('p')
  t.appendChild(document.createTextNode(updateTitle));
  t.setAttribute('class', 'title');
  content.appendChild(t);
  t = document.createElement('p');
  t.setAttribute('class', 'body');
  t.appendChild(document.createTextNode(updateContent));
  content.appendChild(t);
  container.appendChild(content);

  var actions = document.createElement('div');
  actions.setAttribute("class", "actions");
  t = document.createElement('div');
  t.setAttribute('class', 'action-item update');
  t.setAttribute('onclick', 'updateCache()');
  t.appendChild(document.createTextNode('Update'));
  actions.appendChild(t);
  t = document.createElement('div');
  t.setAttribute('class', 'action-item close');
  t.setAttribute("onclick", "dismissUpdateNotification()");
  t.appendChild(document.createTextNode('Cancel'));
  actions.appendChild(t)
  container.appendChild(actions);

  document.getElementById('app').appendChild(container);
}
function dismissUpdateNotification() {
  var noti = document.getElementById('update-notification');
  noti.classList.remove('show');
  setTimeout(function () {
    noti.remove();
  }, 300);
}
function updateCache() {
  SwReg.unregister().then(function(){
    window.location.reload();
  });
}
(function(){
  let app = new Vue({
    el: '#app',
    data: {
      galleryId: 1,
      galleryList: [],
      imageList: [],
      isMenuShow: false,
      isResultShow: false,
      image: '',
      selectedItems: [],
      isMultipleSelect: false,
      disabledItems: [],
    },
    created() {
      this.getAllGallery(this.getImage);
    },
    computed: {
      isDisableAction(){
        let _this = this;
        return this.selectedItems.reduce(function(acc, item){
          return acc + (_this.disabledItems.indexOf(item) >= 0 ? 1 : -1);
        }, 0) < 0;
      }
    },
    methods: {
      toggleMenu() {
        this.isMenuShow = !this.isMenuShow;
      },
      addGallery(e) {
        e.stopPropagation();
        var _this = this
        var newGallery = window.prompt("Enter new gallery name");
        if (!newGallery) return;
        this.getDBRequest(function (db) {
          var transaction = db.transaction('gallery', 'readwrite');
          var store = transaction.objectStore('gallery');
          var request = store.add({ name: newGallery });
          request.onsuccess = function (event) {
            _this.galleryList.push({
              id: event.target.result,
              name: newGallery,
            })
          }
        })
      },
      getAllGallery(callback = undefined) {
        var _this = this
        this.getDBRequest(function (db) {
          var transaction = db.transaction('gallery', 'readonly');
          var store = transaction.objectStore('gallery');
          store.openCursor().onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              _this.galleryList.push({
                id: cursor.key,
                name: cursor.value.name,
              })
              cursor.continue();
            } else {
              _this.galleryId = _this.galleryList[0] ? _this.galleryList[0].id : undefined;
              if (callback) {
                callback();
              }
            }
          }
        })
      },
      changeGallery(galleryId) {
        if (this.galleryId == galleryId) return;
        this.galleryId = galleryId;
        this.imageList = [];
        this.disabledItems = [];
        this.getImage();
      },
      triggerFileSelect() {
        document.getElementById('file-select').click();
      },
      deleteGallery(e, galleryId) {
        e.stopPropagation();
        if (!window.confirm("Do you really want to delete this gallery?")) return;
        var _this = this;
        this.getDBRequest(function (db) {
          var transaction = db.transaction(['images', 'gallery'], 'readwrite');
          var store = transaction.objectStore('gallery');
          var request = store.delete(galleryId);
          request.onsuccess = function () {
            _this.galleryList = _this.galleryList.filter(function (item) { return item.id != galleryId });
            if (_this.galleryId == galleryId) {
              if (_this.galleryList.length > 0) {
                _this.galleryId = _this.galleryList[0].id;
                _this.getImage();
              } else {
                _this.galleryId = undefined;
                _this.imageList = [];
              }
            }
            var imageStore = transaction.objectStore('images');
            var keyArr = []
            imageStore.openCursor().onsuccess = function (e) {
              var cursor = e.target.result;
              if (cursor) {
                if (cursor.value.gallery_id == galleryId) {
                  keyArr.push(cursor.key);
                }
                cursor.continue()
              } else {
                keyArr.forEach(item => {
                  transaction.objectStore('images').delete(item);
                });
              }
            }
          }
        });
      },
      addImage(e) {
        var files = e.target.files;
        for (var i = 0; i < files.length; i++) {
          this.storeImage(files[i]);
        };
        e.target.value = '';
      },
      storeImage(file) {
        const _this = this;
        var reader = new FileReader();
        reader.onload = async function () {
          var fileData = await _this.resizeImage(reader.result);
          
          _this.getDBRequest(function (db) {
            var transaction = db.transaction('images', 'readwrite');
            var store = transaction.objectStore('images');
            var request = store.add({
              gallery_id: _this.galleryId,
              img: fileData
            });

            request.onsuccess = function (event) {
              _this.imageList.push({
                id: event.target.result,
                img: fileData
              });
              _this.reorderImages();
            }
          })
        }
        reader.readAsDataURL(file);
      },
      getImage() {
        var _this = this;
        this.getDBRequest(function (db) {
          var transaction = db.transaction('images', 'readonly');
          var store = transaction.objectStore('images');
          store.openCursor().onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              if (cursor.value.gallery_id == _this.galleryId) {
                _this.imageList.push({
                  id: cursor.key,
                  gallery_id: cursor.value.gallery_id,
                  img: cursor.value.img,
                })
              }
              cursor.continue();
            }
          }
        })
      },
      deleteImage(imageId) {
        var _this = this;
        this.getDBRequest(function (db) {
          var request = db.transaction('images', 'readwrite').objectStore('images').delete(imageId);
          request.onsuccess = function () {
            _this.imageList = _this.imageList.filter(function (item) { return item.id != imageId; });
          }
        });
      },
      getDBRequest(callback) {
        var request = window.indexedDB.open('shakeup_db', 3);
        request.onupgradeneeded = function (event) {
          db = event.target.result;
          var objStore = db.createObjectStore('gallery', {
            autoIncrement: true
          });
          db.createObjectStore('images', {
            autoIncrement: true
          });
          if (event.oldVersion === 0) {
            objStore.transaction.oncomplete = function (e) {
              db.transaction('gallery', 'readwrite')
                .objectStore('gallery')
                .add({ name: 'New gallery' });
            };
          }
        }
        request.onsuccess = function (event) {
          var db = event.target.result;
          callback(db);
        };

        request.onerror = function (event) {
          alert("Unable to add data\r\nPrasad is already exist in your database! ");
        }
      },
      shuffleImage() {
        var _this = this;
        var ln = this.imageList.length - this.disabledItems.length;
        if (ln < 2) return;
        return new Promise(function(resolve){
          var intervalCount = 0
          var disableImages = _this.imageList.filter(function (item) { return _this.disabledItems.indexOf(item.id) >= 0; })
          var intervalIdx = setInterval(function () {
            intervalCount++;
            var newOrder = _this.generateRandomOrder(ln);
            _this.imageList = [
              ...newOrder.map(function (item) { return _this.imageList[item]; }),
              ...disableImages
            ];
            if (intervalCount >= 10) {
              clearInterval(intervalIdx);
              resolve();
              _this.showViewer(0);
            }
          }, 200);
        })
      },
      showViewer(id) {
        window.history.pushState('','', window.location.origin+'/#viewImage');
        this.image = this.imageList[id].img
        this.isResultShow = true;
      },
      generateRandomOrder(length) {
        var arr = [];
        for (var i = 0; i < length; i++) arr.push(i);
        var orderArr = [];
        while (arr.length > 0) {
          var idx = this.randInt(arr.length);
          orderArr.push(arr.splice(idx, 1)[0]);
        }
        return orderArr;
      },
      randInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
      },
      resizeImage(src) {
        let img = new Image();
        return new Promise(function(resolve) {
          img.onload = function(){
            let canvas = document.createElement('canvas');
            let w = 300; let h = Math.floor(300 * img.height / img.width);
            canvas.width = w; canvas.height = h;
            ctx = canvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL());
          };
          img.src = src;
        });
      },
      hideViewer() {
        this.isResultShow = false;
        window.history.back();
      },
      showMultipleSelect(e, id) {
        e.preventDefault();
        this.isMultipleSelect = true;
        this.selectedItems = [id];
        window.history.pushState('','', window.location.origin+'/#multiSelect');
      },
      hideMultipleSelect() {
        this.isMultipleSelect = false;
        this.selectedItems = [];
        window.history.back();
      },
      toggleSelect(id) {
        let pos = this.selectedItems.indexOf(id);
        if ( pos < 0) {
          this.selectedItems.push(id);
        }
        else {
          this.selectedItems.splice(pos, 1);
        }
      },
      deleteImages() {
        let _this = this;
        if (window.confirm(`${this.selectedItems.length} item(s) will be removed and cannot be undone. Are you sure?`)) {
          this.selectedItems.forEach(function(id) {
            _this.deleteImage(id);
          });
          this.hideMultipleSelect();
        }
      },
      toggleDisableImages() {
        let _this = this;
        if (this.isDisableAction) {
          this.disabledItems = this.selectedItems.reduce(function(acc, item){
            return acc.indexOf(item) < 0 ? [...acc, item] : acc;
          }, this.disabledItems);
        }
        else {
          this.disabledItems = this.disabledItems.filter(function(item){
            return _this.selectedItems.indexOf(item) < 0;
          });
        }
        this.reorderImages();
        this.hideMultipleSelect();
      },
      reorderImages() {
        let _this = this;
        this.imageList = [
          ...this.imageList.filter(function(item){
            return _this.disabledItems.indexOf(item.id) < 0;
          }),
          ...this.imageList.filter(function(item){
            return _this.disabledItems.indexOf(item.id) >= 0;
          })
        ];
      }
    }
  });
  let alphaOld = undefined;
  let confirmShake = 0;
  let shakeLock = false;
  let shakeProcessTimeout = undefined;
  window.addEventListener('deviceorientation', function(e){
    if (shakeLock || app.isResultShow) return;
    if (alphaOld === undefined) {
      alphaOld = e.alpha;
      return;
    }
    if (Math.abs(e.alpha - alphaOld) > 90) {
      if (shakeProcessTimeout) {
        clearTimeout(shakeProcessTimeout);
      }
      shakeProcessTimeout = setTimeout(function(){
        confirmShake = 0;
      }, 3000);
      alphaOld = e.alpha;
      confirmShake++;
      if (confirmShake > 9) {
        shakeLock = true;
        confirmShake = 0;
        alphaOld = undefined;
        app.shuffleImage().then(function(){ shakeLock = false;});
        if (window.navigator.vibrate) {
          window.navigator.vibrate([200, 200, 200]);
        }
      }
    }
  });
  window.addEventListener('hashchange', function() {
    app.isResultShow = false;
    app.isMultipleSelect = false;
  });
})()