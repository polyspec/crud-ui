package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"

	generator "github.com/polyspec/crudui/packages/generator/go"
	"github.com/polyspec/crudui/packages/validator/go/validator/validate"
)

// The form, list and detail specifications describe the same record. The example stores one
// record: the list shows the stored record as its only row and the detail shows that record.
const specification = `{"type":"group","properties":{"name":{"type":"text","label":{"en":"Name","ko":"이름"},"validate":{"required":true,"minlength":2}},"email":{"type":"email","label":{"en":"Email","ko":"이메일"},"validate":{"required":true,"email":true}},"joined":{"type":"date","label":{"en":"Joined","ko":"가입일"}}}}`

// The list links each name to the detail page and shows the email as text and the joined date.
const listSpecification = `{"columns":{"name":{"field":"name","label":{"en":"Name","ko":"이름"},"format":{"type":"link","href":"/detail"}},"email":{"field":"email","label":{"en":"Email","ko":"이메일"},"format":"text"},"joined":{"field":"joined","label":{"en":"Joined","ko":"가입일"},"format":{"type":"date","pattern":"YYYY-MM-DD"}}}}`

// The detail shows the name as text, the email as a mailto link and the joined date.
const detailSpecification = `{"fields":{"name":{"field":"name","label":{"en":"Name","ko":"이름"},"format":"text"},"email":{"field":"email","label":{"en":"Email","ko":"이메일"},"format":{"type":"link","href":"mailto:{=email}"}},"joined":{"field":"joined","label":{"en":"Joined","ko":"가입일"},"format":{"type":"date","pattern":"YYYY-MM-DD"}}}}`

// formInputs lists the record fields a urlencoded submission may set.
var formInputs = []string{"name", "email", "joined"}

type server struct {
	spec       *generator.Object
	listSpec   *generator.Object
	detailSpec *generator.Object
	template   *generator.FormTemplate
	file       string
	stylesheet string
	mu         sync.Mutex
}

func decodeObject(source string) (*generator.Object, error) {
	decoded, e := generator.DecodeJSON([]byte(source))
	if e != nil {
		return nil, e
	}
	o, ok := decoded.(*generator.Object)
	if !ok {
		return nil, fmt.Errorf("Specification must be an object")
	}
	return o, nil
}

// newServer decodes the three specifications and compiles the form template once.
func newServer(file, stylesheet string) (*server, error) {
	spec, e := decodeObject(specification)
	if e != nil {
		return nil, e
	}
	listSpec, e := decodeObject(listSpecification)
	if e != nil {
		return nil, e
	}
	detailSpec, e := decodeObject(detailSpecification)
	if e != nil {
		return nil, e
	}
	template, e := generator.CompileForm(spec, generator.CompileOptions{KeyPrefix: "profile"})
	if e != nil {
		return nil, e
	}
	return &server{spec: spec, listSpec: listSpec, detailSpec: detailSpec, template: template, file: file, stylesheet: stylesheet}, nil
}

func main() {
	address := flag.String("listen", "127.0.0.1:8087", "HTTP listen address")
	file := flag.String("data", "", "Explicit JSON record file path")
	stylesheetFile := flag.String("stylesheet", "../ts/styles/crudui.css", "The crudui.css stylesheet the pages take every style from")
	flag.Parse()
	if *file == "" {
		log.Fatal("-data must specify the JSON record file")
	}
	stylesheet, e := os.ReadFile(*stylesheetFile)
	if e != nil {
		log.Fatal(e)
	}
	app, e := newServer(*file, string(stylesheet))
	if e != nil {
		log.Fatal(e)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", app.form)
	mux.HandleFunc("/list", app.list)
	mux.HandleFunc("/detail", app.detail)
	mux.HandleFunc("/data", app.data)
	mux.HandleFunc("/template", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, app.template)
	})
	httpServer := &http.Server{Addr: *address, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("Go form example: http://%s (list: /list, detail: /detail)", *address)
	log.Fatal(httpServer.ListenAndServe())
}

// load returns the stored record and whether the record file exists.
func (s *server) load() (*generator.Object, bool, error) {
	b, e := os.ReadFile(s.file)
	if os.IsNotExist(e) {
		return generator.NewObject(), false, nil
	}
	if e != nil {
		return nil, false, e
	}
	v, e := generator.DecodeJSON(b)
	if e != nil {
		return nil, false, e
	}
	o, ok := v.(*generator.Object)
	if !ok {
		return nil, false, fmt.Errorf("Stored record must be an object")
	}
	return o, true, nil
}
func (s *server) save(data *generator.Object) error {
	b, e := json.MarshalIndent(data, "", "  ")
	if e != nil {
		return e
	}
	f, e := os.CreateTemp(filepath.Dir(s.file), "crudui-record-*.json")
	if e != nil {
		return e
	}
	name := f.Name()
	_, e = f.Write(append(b, '\n'))
	if e = errors.Join(e, f.Close()); e == nil {
		e = os.Rename(name, s.file)
	}
	if e != nil {
		// The temporary file stays only when the replacement failed.
		return errors.Join(e, os.Remove(name))
	}
	return nil
}

// page writes one HTML page. The page styles only its own layout; the generated markup takes
// every style from crudui.css.
func (s *server) page(w http.ResponseWriter, title, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if _, e := io.WriteString(w, `<!doctype html><html lang="en"><meta charset="utf-8"><title>`+title+`</title><style>body{max-width:42rem;margin:3rem auto;font-family:system-ui}</style><style>`+s.stylesheet+`</style><h1>`+title+`</h1>`+body+`<p><a href="/">Form</a> · <a href="/list">List</a> · <a href="/detail">Detail</a> · <a href="/data">Stored JSON</a> · <a href="/template">Compiled template</a></p></html>`); e != nil {
		log.Print(e)
	}
}

// loadForGet serves only GET and returns the stored record, writing the error response otherwise.
func (s *server) loadForGet(w http.ResponseWriter, r *http.Request) (*generator.Object, bool, bool) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return nil, false, false
	}
	s.mu.Lock()
	data, stored, e := s.load()
	s.mu.Unlock()
	if e != nil {
		http.Error(w, e.Error(), http.StatusInternalServerError)
		return nil, false, false
	}
	return data, stored, true
}

func (s *server) form(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	switch r.Method {
	case http.MethodGet:
		data, _, ok := s.loadForGet(w, r)
		if !ok {
			return
		}
		form, e := generator.NewForm(s.template, data, generator.BindOptions{Language: "en"})
		if e != nil {
			http.Error(w, e.Error(), http.StatusInternalServerError)
			return
		}
		html, e := generator.RenderForm(form, nil)
		if e != nil {
			http.Error(w, e.Error(), http.StatusInternalServerError)
			return
		}
		s.page(w, "CRUDUI Go form", `<form method="post">`+html+`</form>`)
	case http.MethodPost:
		s.submit(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// list renders the stored records: the stored record is the only row, and no file means no rows.
func (s *server) list(w http.ResponseWriter, r *http.Request) {
	data, stored, ok := s.loadForGet(w, r)
	if !ok {
		return
	}
	rows := []*generator.Object{}
	if stored {
		rows = append(rows, data)
	}
	html, e := generator.RenderList(s.listSpec, rows, generator.ListOptions{Language: "en"})
	if e != nil {
		http.Error(w, e.Error(), http.StatusInternalServerError)
		return
	}
	s.page(w, "CRUDUI Go list", html)
}

// detail renders the stored record; no file means an empty record.
func (s *server) detail(w http.ResponseWriter, r *http.Request) {
	data, _, ok := s.loadForGet(w, r)
	if !ok {
		return
	}
	html, e := generator.RenderDetail(s.detailSpec, data, generator.DetailOptions{Language: "en"})
	if e != nil {
		http.Error(w, e.Error(), http.StatusInternalServerError)
		return
	}
	s.page(w, "CRUDUI Go detail", html)
}

func (s *server) data(w http.ResponseWriter, r *http.Request) {
	data, _, ok := s.loadForGet(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, data)
}
func (s *server) submit(w http.ResponseWriter, r *http.Request) {
	body, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if e != nil {
		http.Error(w, e.Error(), http.StatusBadRequest)
		return
	}
	contentType, _, e := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if e != nil {
		http.Error(w, "Content-Type is required", http.StatusUnsupportedMediaType)
		return
	}
	var data *generator.Object
	switch contentType {
	case "application/json":
		value, err := generator.DecodeJSON(body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var isObject bool
		data, isObject = value.(*generator.Object)
		if !isObject || data == nil {
			http.Error(w, "Record must be an object", http.StatusBadRequest)
			return
		}
	case "application/x-www-form-urlencoded":
		values, err := url.ParseQuery(string(body))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		data = generator.NewObject()
		for _, name := range formInputs {
			input := "profile[" + name + "]"
			if values.Has(input) {
				if len(values[input]) != 1 {
					http.Error(w, "A field must have one value", http.StatusBadRequest)
					return
				}
				data.Set(name, values.Get(input))
			}
		}
	default:
		http.Error(w, "Use form or JSON content", http.StatusUnsupportedMediaType)
		return
	}
	encoded, e := json.Marshal(data)
	if e != nil {
		http.Error(w, e.Error(), http.StatusBadRequest)
		return
	}
	lookup := map[string]any{}
	if e = json.Unmarshal(encoded, &lookup); e != nil {
		http.Error(w, e.Error(), http.StatusBadRequest)
		return
	}
	result, e := validate.Validate(s.spec, lookup, validate.Options{})
	var inputErr *validate.FormInputError
	if errors.As(e, &inputErr) {
		http.Error(w, e.Error(), http.StatusBadRequest)
		return
	}
	if e != nil {
		http.Error(w, e.Error(), http.StatusInternalServerError)
		return
	}
	if !result.Valid {
		writeJSON(w, http.StatusUnprocessableEntity, result)
		return
	}
	s.mu.Lock()
	e = s.save(data)
	s.mu.Unlock()
	if e != nil {
		http.Error(w, e.Error(), http.StatusInternalServerError)
		return
	}
	if contentType == "application/json" {
		writeJSON(w, http.StatusOK, data)
	} else {
		http.Redirect(w, r, "/", http.StatusSeeOther)
	}
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	if e := enc.Encode(value); e != nil {
		log.Printf("JSON response failed: %v", e)
	}
}
