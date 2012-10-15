$:.push File.expand_path("../lib", __FILE__)

# Maintain your gem's version:
require "condo_interface/version"

# Describe your gem and declare its dependencies:
Gem::Specification.new do |s|
  s.name        = "condo_interface"
  s.version     = CondoInterface::VERSION
  s.authors     = ["Stephen von Takach"]
  s.email       = ["steve@cotag.me"]
  s.homepage    = "http://cotag.me/"
  s.summary     = "The default interface for CoTag Condo."
  s.description = "A feature rich, embeddable, responsive interface for CoTag Condo."

  s.files = Dir["{app,config,db,lib}/**/*"] + ["MIT-LICENSE", "Rakefile", "README.textile"]
  s.test_files = Dir["test/**/*"]

  s.add_dependency "rails", ">= 3.1.0"
  # s.add_dependency "jquery-rails"

  s.add_development_dependency "sqlite3"
end
