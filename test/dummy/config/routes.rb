Rails.application.routes.draw do

  mount CondoInterface::Engine => "/condo_interface"
end
